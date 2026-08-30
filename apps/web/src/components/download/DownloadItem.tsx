/**
 * DownloadItem — 单文件下载控件。
 *
 * 职责：根据文件大小选择路径 ——
 *  - < 100 MB：直接锚点下载（浏览器自动保存）；
 *  - >= 100 MB：分片下载，展示 antd Progress + 速度/ETA + 暂停/继续/取消。
 *
 * 同时用在 /database 下载抽屉与 Sample 详情页文件表里。
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

/** 大文件：分片下载。 */
function ChunkedDownloadButton({ sampleId, file }: DownloadItemProps): JSX.Element {
  const { t } = useAppIntl();
  const dl = useChunkedDownload({ sampleId, fileName: file.file, totalBytes: file.size_bytes });

  const sizeLabel = formatBytes(file.size_bytes);

  // 空闲态：开始按钮。
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
      {typeof window.showSaveFilePicker !== 'function' && dl.isActive && (
        <Tooltip title={t('download.fallbackNote')}>
          <Tag className="dl-chunked__fallback-note">{t('download.fallbackNote')}</Tag>
        </Tooltip>
      )}
    </div>
  );
}
