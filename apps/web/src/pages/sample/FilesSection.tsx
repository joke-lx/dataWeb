/**
 * FilesSection — Sample 详情页文件区块。
 *
 * 职责：展示该样本的可下载文件（共享 `<FileTable>`）。compare 模式只展示
 * 样本 A 的文件（B 的文件可从数据库页下载）。
 */

import type { JSX } from 'react';

import { FileTable } from '../../components/download/FileTable';
import { useAppIntl } from '../../i18n';

interface FilesSectionProps {
  sampleId: string;
  compareActive?: boolean;
}

/**
 * 文件区块。
 */
export function FilesSection({ sampleId, compareActive }: FilesSectionProps): JSX.Element {
  const { t } = useAppIntl();
  return (
    <div className="sample-files">
      <p className="sample-files__desc">
        {compareActive
          ? t('sample.files.descCompare')
          : t('sample.files.desc', { id: sampleId })}
      </p>
      <FileTable sampleId={sampleId} />
    </div>
  );
}
