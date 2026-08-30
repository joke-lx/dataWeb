/**
 * 下载工具：分片阈值、URL 构建、字节/速度/ETA 格式化。
 *
 * 供 useChunkedDownload 与 DownloadItem / FileTable 共享。
 */

import { buildDownloadUrl } from '../../api/client';

/** 超过此大小（100 MB）的文件走分片下载；否则直接锚点下载。 */
export const DIRECT_DOWNLOAD_LIMIT = 100 * 1024 * 1024;

/** 单个分片大小（8 MB）。 */
export const CHUNK_SIZE = 8 * 1024 * 1024;

export { buildDownloadUrl };

/** 是否走分片下载路径。 */
export function isChunked(sizeBytes: number): boolean {
  return sizeBytes > DIRECT_DOWNLOAD_LIMIT;
}

/** 把字节数格式化为人类可读（B / KiB / MiB / GiB）。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 'B';
  for (const u of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = u;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

/** 把字节/秒格式化为速度。 */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

/** 把秒数格式化为 ETA（如 3m 24s / 45s）。 */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}
