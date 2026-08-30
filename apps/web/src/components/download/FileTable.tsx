/**
 * FileTable — 样本可下载文件表格（antd Table）。
 *
 * 职责：拉取某样本的文件列表并渲染为表格（文件名 / 格式 / 大小 / 操作），
 * 每行操作由 `<DownloadItem>` 承担。在 /database 下载抽屉与 Sample 详情页
 * 文件区块共享。
 */

import { type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Tag } from 'antd';

import { fetchSampleFiles } from '../../api/client';
import type { SampleFileMeta } from '../../api/types';
import { useAppIntl } from '../../i18n';
import { DownloadItem } from './DownloadItem';
import { formatBytes } from './downloadUtils';
import './download.css';

interface FileTableProps {
  sampleId: string;
}

/**
 * 文件表格。
 */
export function FileTable({ sampleId }: FileTableProps): JSX.Element {
  const { t } = useAppIntl();
  const { data, isLoading, error } = useQuery({
    queryKey: ['sample-files', sampleId],
    queryFn: () => fetchSampleFiles(sampleId),
  });

  const columns = [
    {
      title: t('file.name'),
      dataIndex: 'file',
      key: 'file',
      render: (name: string) => (
        <span className="ft-filename">{name}</span>
      ),
    },
    {
      title: t('file.format'),
      dataIndex: 'format',
      key: 'format',
      width: 100,
      render: (format: string) => <Tag className="ft-format">{format}</Tag>,
    },
    {
      title: t('file.size'),
      dataIndex: 'size_bytes',
      key: 'size_bytes',
      width: 110,
      align: 'right' as const,
      render: (size: number) => (
        <span className="ft-size">{formatBytes(size)}</span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 170,
      align: 'right' as const,
      render: (_: unknown, file: SampleFileMeta) => (
        <DownloadItem sampleId={sampleId} file={file} />
      ),
    },
  ];

  if (isLoading) return <div className="ft-loading">{t('common.loading')}</div>;
  if (error instanceof Error) {
    return <div className="ft-error">{t('species.error', { message: error.message })}</div>;
  }

  return (
    <Table
      size="small"
      rowKey="file"
      columns={columns}
      dataSource={data ?? []}
      pagination={false}
      className="ft-table"
    />
  );
}
