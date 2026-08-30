/**
 * useChunkedDownload — 大文件分片下载管理器。
 *
 * 职责：把一个大文件拆成 8 MB 分片、3 路并发拉取（HTTP Range），支持
 * 暂停 / 继续 / 取消，并实时上报进度 / 速度 / ETA。
 *
 * 写入路径：
 *  A. File System Access API（Chrome/Edge）—— 单个 createWritable +
 *     显式 position 写入，乱序完成安全，取消 = abort() 丢弃；
 *  B. 兜底（Firefox/Safari）—— 分片 Blob 在内存组装成完整文件后触发
 *     浏览器下载（大文件内存占用高，UI 会提示推荐 Chrome）。
 *
 * 关键约束：`start()` 必须在用户点击事件的同步调用栈里执行（否则
 * `showSaveFilePicker` 会因缺少 user gesture 被浏览器拒绝）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildDownloadUrl } from '../api/client';

/** 分片大小。 */
const CHUNK_SIZE = 8 * 1024 * 1024;
/** 并发分片数。 */
const CONCURRENCY = 3;
/** 进度刷新间隔（ms）。 */
const PROGRESS_TICK_MS = 200;
/** 速度滑窗取样（≥3s 的累计字节差分）。 */
const SPEED_WINDOW_MS = 3000;

export type DownloadStatus =
  | 'idle'
  | 'preparing'
  | 'downloading'
  | 'paused'
  | 'finishing'
  | 'done'
  | 'error';

interface Chunk {
  index: number;
  start: number;
  end: number; // inclusive
  received: number;
  done: boolean;
  blob: Blob | null;
}

export interface ChunkedDownloadState {
  status: DownloadStatus;
  progressBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  error: string | null;
}

interface UseChunkedDownloadOptions {
  sampleId: string;
  fileName: string;
  totalBytes: number;
}

interface UseChunkedDownloadResult extends ChunkedDownloadState {
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isActive: boolean;
}

/**
 * 分片下载 hook。
 *
 * @param opts - sampleId / fileName / totalBytes。
 */
export function useChunkedDownload({
  sampleId,
  fileName,
  totalBytes,
}: UseChunkedDownloadOptions): UseChunkedDownloadResult {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progressBytes, setProgressBytes] = useState(0);
  const [speedBytesPerSec, setSpeedBytesPerSec] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 可变工作区：chunks / 控制器 / 游标 / 写入句柄都放 ref，避免渲染风暴。
  const chunksRef = useRef<Chunk[]>([]);
  const aborterRef = useRef<AbortController | null>(null);
  const writableRef = useRef<FileSystemWritableFileStream | null>(null);
  const fallbackBlobsRef = useRef<Map<number, Blob> | null>(null);
  const cursorRef = useRef(0); // 下一个待取分片下标
  const doneCountRef = useRef(0);
  const activeWorkersRef = useRef(0);
  const totalBytesRef = useRef(totalBytes);

  // 进度/速度滑动窗口。
  const samplesRef = useRef<Array<{ t: number; bytes: number }>>([]);
  const progressRef = useRef(0);
  const lastTickProgressRef = useRef(0);
  const lastTickTimeRef = useRef(0);

  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    totalBytesRef.current = totalBytes;
    progressRef.current = 0;
    lastTickProgressRef.current = 0;
    lastTickTimeRef.current = 0;
    samplesRef.current = [];
  }, [totalBytes]);

  // 组装进度 tick：把 ref 里的累计字节刷成 state（节流）。
  const flushProgress = useCallback(() => {
    const now = performance.now();
    const bytes = progressRef.current;
    const lastT = lastTickTimeRef.current;
    if (lastT > 0 && now > lastT) {
      samplesRef.current.push({ t: now, bytes });
      // 只保留窗口内取样。
      const cutoff = now - SPEED_WINDOW_MS;
      samplesRef.current = samplesRef.current.filter((s) => s.t >= cutoff);
    }
    lastTickProgressRef.current = bytes;
    lastTickTimeRef.current = now;

    let speed = 0;
    if (samplesRef.current.length >= 2) {
      const a = samplesRef.current[0];
      const b = samplesRef.current[samplesRef.current.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.4) speed = (b.bytes - a.bytes) / dt;
    }
    setProgressBytes(bytes);
    setSpeedBytesPerSec(speed);
    setEtaSeconds(totalBytesRef.current > 0 && speed > 0
      ? (totalBytesRef.current - bytes) / speed
      : 0);
  }, []);

  // 状态机辅助：把进度/速度归零。
  const resetProgress = useCallback(() => {
    progressRef.current = 0;
    lastTickProgressRef.current = 0;
    lastTickTimeRef.current = 0;
    samplesRef.current = [];
    setProgressBytes(0);
    setSpeedBytesPerSec(0);
    setEtaSeconds(0);
  }, []);

  const cleanup = useCallback(() => {
    aborterRef.current?.abort();
    aborterRef.current = null;
    writableRef.current = null;
    fallbackBlobsRef.current = null;
    activeWorkersRef.current = 0;
    cursorRef.current = 0;
    doneCountRef.current = 0;
  }, []);

  /** 写一个已完成分片到 writable / fallback 集合。 */
  const writeChunk = useCallback(async (chunk: Chunk) => {
    if (!chunk.blob) return;
    if (writableRef.current) {
      await writableRef.current.write({
        type: 'write',
        position: chunk.start,
        data: chunk.blob,
      });
    } else if (fallbackBlobsRef.current) {
      fallbackBlobsRef.current.set(chunk.index, chunk.blob);
    }
  }, []);

  /** 单 worker：循环取 pending 分片并拉取。 */
  const workerLoop = useCallback(async () => {
    const url = buildDownloadUrl(sampleId, fileName);
    while (true) {
      const chunks = chunksRef.current;
      let index = -1;
      // 找下一个未开始的分片。
      for (let i = cursorRef.current; i < chunks.length; i += 1) {
        if (!chunks[i].done && chunks[i].received === 0) {
          index = i;
          break;
        }
      }
      if (index < 0) break;
      cursorRef.current = index + 1;
      const chunk = chunks[index];
      activeWorkersRef.current += 1;
      try {
        const res = await fetch(url, {
          headers: { Range: `bytes=${chunk.start}-${chunk.end}` },
          signal: aborterRef.current?.signal,
        });
        if (res.status !== 206) {
          // 服务器忽略了 Range —— 分片拼接会损坏，fail-loud。
          throw new Error(`expected 206, got ${res.status}`);
        }
        if (!res.body) throw new Error('no response body');
        const reader = res.body.getReader();
        const parts: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            parts.push(value);
            received += value.byteLength;
            chunk.received = received;
            progressRef.current += value.byteLength;
          }
        }
        chunk.blob = new Blob(parts as BlobPart[]);
        chunk.done = true;
        doneCountRef.current += 1;
        await writeChunk(chunk);
      } finally {
        activeWorkersRef.current -= 1;
      }
    }
    // 全部完成 → finishing。
    if (doneCountRef.current === chunksRef.current.length) {
      setStatus('finishing');
      finishRef.current?.();
    }
  }, [sampleId, fileName, writeChunk]);

  /** 开始一次下载（必须由用户手势同步调用）。 */
  const start = useCallback(() => {
    setError(null);
    resetProgress();
    cleanup();

    // 预构造分片计划。
    const chunks: Chunk[] = [];
    for (let off = 0; off < totalBytesRef.current; off += CHUNK_SIZE) {
      chunks.push({
        index: chunks.length,
        start: off,
        end: Math.min(off + CHUNK_SIZE - 1, totalBytesRef.current - 1),
        received: 0,
        done: false,
        blob: null,
      });
    }
    chunksRef.current = chunks;
    cursorRef.current = 0;
    doneCountRef.current = 0;

    const ac = new AbortController();
    aborterRef.current = ac;
    setStatus('preparing');

    const run = async () => {
      try {
        // 尝试获取 FS Access 写入句柄（需在同步用户手势内）。
        let useFSAccess = false;
        if (typeof window.showSaveFilePicker === 'function') {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: fileName,
              types: [{ description: 'Data file', accept: { 'application/octet-stream': ['.bin', '.bw', '.bedgraph', '.bed', '.vcf'] } }],
            });
            writableRef.current = await handle.createWritable({ keepExistingData: true });
            useFSAccess = true;
          } catch (pickerErr) {
            // 用户取消保存对话框 —— 中止本次。
            setStatus('idle');
            cleanup();
            return;
          }
        }
        if (!useFSAccess) {
          fallbackBlobsRef.current = new Map();
        }
        setStatus('downloading');
        // 3 路并发 worker。
        const workers: Promise<void>[] = [];
        for (let i = 0; i < CONCURRENCY; i += 1) {
          workers.push(workerLoop());
        }
        await Promise.all(workers);
        // 全部 chunk done → 收尾。
        if (writableRef.current) {
          await writableRef.current.close();
          writableRef.current = null;
        } else if (fallbackBlobsRef.current) {
          await assembleAndTriggerDownload();
        }
        setStatus('done');
        cleanup();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          // 主动暂停/取消 —— 不当作错误。
          setStatus(activeWorkersRef.current > 0 || cursorRef.current > 0 ? 'paused' : 'idle');
          return;
        }
        setStatus('error');
        setError((err as Error)?.message ?? String(err));
      }
    };

    // 兜底组装（无 FS Access）。
    const assembleAndTriggerDownload = async () => {
      const blobs = fallbackBlobsRef.current;
      if (!blobs) return;
      const sorted = chunksRef.current
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((c) => c.blob)
        .filter((b): b is Blob => b !== null);
      const full = new Blob(sorted, { type: 'application/octet-stream' });
      const url = URL.createObjectURL(full);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    finishRef.current = async () => {
      // finishing 分支：等 worker 都退干净后 close。
      while (activeWorkersRef.current > 0) {
        await new Promise((r) => setTimeout(r, 20));
      }
      if (writableRef.current) {
        await writableRef.current.close();
        writableRef.current = null;
      } else if (fallbackBlobsRef.current) {
        await assembleAndTriggerDownload();
      }
      setStatus('done');
      cleanup();
    };

    void run();
  }, [cleanup, fileName, resetProgress, workerLoop]);

  /** 暂停：abort 在途请求，已完成分片保留。 */
  const pause = useCallback(() => {
    if (status !== 'downloading') return;
    aborterRef.current?.abort();
    aborterRef.current = null;
    // 在途 chunk 未完成 → 重置 received 以便恢复时重拉。
    for (const c of chunksRef.current) {
      if (!c.done && c.received > 0) {
        c.received = 0;
        c.blob = null;
      }
    }
    setStatus('paused');
  }, [status]);

  /** 继续 / 重试：新 controller，只拉 pending 分片。 */
  const resume = useCallback(() => {
    if (status !== 'paused' && status !== 'error') return;
    setError(null);
    const ac = new AbortController();
    aborterRef.current = ac;
    setStatus('downloading');
    // 重新计算 cursor：从第一个未 done 且 received==0 的分片开始。
    cursorRef.current = 0;
    for (let i = 0; i < chunksRef.current.length; i += 1) {
      if (!chunksRef.current[i].done) {
        cursorRef.current = i;
        break;
      }
    }
    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENCY; i += 1) {
      workers.push(workerLoop());
    }
    void Promise.all(workers).catch(() => {});
  }, [status, workerLoop]);

  /** 取消：丢弃已写内容并复位。 */
  const cancel = useCallback(() => {
    if (status === 'idle' || status === 'done') return;
    aborterRef.current?.abort();
    aborterRef.current = null;
    void writableRef.current?.abort().catch(() => {});
    writableRef.current = null;
    fallbackBlobsRef.current = null;
    setStatus('idle');
    resetProgress();
    setError(null);
  }, [resetProgress, status]);

  // 进度 tick 定时器（仅 downloading/finishing 活跃）。
  useEffect(() => {
    if (status !== 'downloading' && status !== 'finishing') return;
    const id = window.setInterval(flushProgress, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [flushProgress, status]);

  // 卸载时清理。
  useEffect(() => {
    return () => {
      aborterRef.current?.abort();
      void writableRef.current?.abort().catch(() => {});
    };
  }, []);

  const isActive =
    status === 'downloading' ||
    status === 'preparing' ||
    status === 'finishing' ||
    status === 'paused';

  return {
    status,
    progressBytes,
    totalBytes,
    speedBytesPerSec,
    etaSeconds,
    error,
    start,
    pause,
    resume,
    cancel,
    isActive,
  };
}
