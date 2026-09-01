/**
 * DownloadItem — 单文件下载控件。
 *
 * 职责：根据文件大小选择路径 ——
 *  - < 100 MB：内存 blob + `<a download>` 触发（浏览器自动保存）。
 *  - >= 100 MB 且 File System Access API 可用（Chrome/Edge HTTPS 或
 *    localhost）：useChunkedDownload.start() 弹原生保存框 → 分片流式写盘，
 *    全程零 JS Heap 占用，带进度/暂停/继续。
 *  - >= 100 MB 且 FS Access 不可用（普通 HTTP 部署）：只显示"直存"按钮 —
 *    浏览器原生 GET + Content-Disposition 流式到磁盘，零 JS Heap 占用，
 *    牺牲细粒度进度（浏览器原生下载不暴露回调）。这是普通 HTTP 上
 *    防止 OOM 的唯一安全路径。
 */

import { type JSX } from 'react';
import { Button, Progress, Tag, Tooltip } from 'antd';
import { DownloadOutlined, PauseOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';

import type { SampleFileMeta } from '../../api/types';
import { useChunkedDownload } from '../../hooks/useChunkedDownload';
import { useAppIntl } from '../../i18n';
import {
  buildDownloadUrl,
  formatBytes,
  formatEta,
  formatSpeed,
  isChunked,
} from './downloadUtils';

interface DownloadItemProps {
  sampleId: string;
  file: SampleFileMeta;
}

/**
 * 文件下载行控件。
 */
export function DownloadItem({ sampleId, file }: DownloadItemProps): JSX.Element {
  const { t } = useAppIntl();

  // 小文件：直接锚点下载，不进分片 hook。
  if (!isChunked(file.size_bytes)) {
    return (
      <a
        href={buildDownloadUrl(sampleId, file.file)}
        download
        className="dl-direct"
      >
        <Button size="small" icon={<DownloadOutlined />}>
          {t('download.direct')}
        </Button>
      </a>
    );
  }

  return <ChunkedDownloadButton sampleId={sampleId} file={file} />;
}

/** 大文件：分片下载或直存。 */
function ChunkedDownloadButton({ sampleId, file }: DownloadItemProps): JSX.Element {
  const { t } = useAppIntl();
  const dl = useChunkedDownload({ sampleId, fileName: file.file, totalBytes: file.size_bytes });

  const sizeLabel = formatBytes(file.size_bytes);

  // FS Access API 不可用时（HTTP 上 Chrome 会拒绝），分片走 fallback 会触发内存
  // 组装 Blob 路径（OOM 风险）。这种环境下直接显示"直存"按钮——浏览器原生
  // GET + Content-Disposition 流式到磁盘，零 JS Heap 占用，放弃细粒度进度。
  // 同时不调用 useChunkedDownload.start()，避免误入 fallback 路径。
  const canStreamToDisk = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
  const streamUrl = buildDownloadUrl(sampleId, file.file);

  if (!canStreamToDisk) {
    return (
      <Tooltip title={t('download.fallbackNote')}>
        <a href={streamUrl} download={file.file} className="dl-stream">
          <Button size="small" icon={<DownloadOutlined />}>
            {t('download.direct')} · {sizeLabel}
          </Button>
        </a>
      </Tooltip>
    );
  }

  // 空闲态：开始分片（FS Access 写盘，零内存）。
  if (dl.status === 'idle') {
    return (
      <Button
        size="small"
        type="primary"
        icon={<DownloadOutlined />}
        onClick={() => dl.start()}
      >
        {t('download.start', { size: sizeLabel })}
      </Button>
    );
  }

  const percent = dl.totalBytes > 0
    ? Math.min(100, Math.round((dl.progressBytes / dl.totalBytes) * 100))
    : 0;

  const statusText =
    dl.status === 'preparing'
      ? t('download.status.preparing')
      : dl.status === 'paused'
        ? t('download.status.paused')
        : dl.status === 'finishing'
          ? t('download.status.finishing')
          : dl.status === 'done'
            ? t('download.done')
            : dl.status === 'error'
              ? dl.error ?? t('download.error.network', { message: '' })
              : dl.status === 'downloading'
                ? `${formatBytes(dl.progressBytes)} / ${formatBytes(dl.totalBytes)} · ${formatSpeed(dl.speedBytesPerSec)} · ETA ${formatEta(dl.etaSeconds)}`
                : '';

  return (
    <div className="dl-chunked">
      <Progress
        size="small"
        percent={percent}
        status={
          dl.status === 'error'
            ? 'exception'
            : dl.status === 'done'
              ? 'success'
              : dl.status === 'paused'
                ? 'normal'
                : 'active'
        }
        showInfo={false}
      />
      <div className="dl-chunked__row">
        <span className="dl-chunked__status">{statusText}</span>
        <span className="dl-chunked__actions">
          {dl.status === 'downloading' && (
            <>
              <Button size="small" icon={<PauseOutlined />} onClick={() => dl.pause()}>
                {t('download.pause')}
              </Button>
              <Button size="small" icon={<StopOutlined />} onClick={() => dl.cancel()}>
                {t('download.cancel')}
              </Button>
            </>
          )}
          {(dl.status === 'paused' || dl.status === 'error') && (
            <>
              <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => dl.resume()}>
                {dl.status === 'error' ? t('download.retry') : t('download.resume')}
              </Button>
              <Button size="small" icon={<StopOutlined />} onClick={() => dl.cancel()}>
                {t('download.cancel')}
              </Button>
            </>
          )}
          {dl.status === 'done' && <Tag color="success">{t('download.done')}</Tag>}
        </span>
      </div>
      {dl.status === 'error' && (
        <div className="dl-chunked__error">{dl.error}</div>
      )}
    </div>
  );
}
