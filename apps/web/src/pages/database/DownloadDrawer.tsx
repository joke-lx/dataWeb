/**
 * DownloadDrawer — /database 下载抽屉（antd Drawer）。
 *
 * 职责：用户在某样本上点"下载"时，从右侧滑出抽屉，展示该样本的可下载
 * 文件表格（复用共享的 `<FileTable>`，每行有直接/分片下载控件）。
 */

import type { JSX } from 'react';
import { Drawer } from 'antd';

import type { Sample } from '../../api/types';
import { FileTable } from '../../components/download/FileTable';
import { useAppIntl } from '../../i18n';

interface DownloadDrawerProps {
  sample: Sample | null;
  onClose: () => void;
}

/**
 * 样本下载抽屉。
 */
export function DownloadDrawer({ sample, onClose }: DownloadDrawerProps): JSX.Element {
  const { t } = useAppIntl();
  return (
    <Drawer
      title={sample ? t('database.drawer.title', { id: sample.id }) : ''}
      width={540}
      open={sample !== null}
      onClose={onClose}
    >
      {sample && (
        <>
          <p className="db-drawer__desc">{t('database.drawer.desc', { id: sample.id })}</p>
          <FileTable sampleId={sample.id} />
        </>
      )}
    </Drawer>
  );
}
