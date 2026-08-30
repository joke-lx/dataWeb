/**
 * ResultCard — /database 结果卡片（antd Card）。
 *
 * 职责：横向展示单个样本 —— 左侧组织图标、中间 id + 元信息 + Tags、
 * 右侧操作（可视化 / 下载）。
 */

import type { JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Tag } from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';

import type { Sample } from '../../api/types';
import { tissueIcon } from '../../components/icons/tissueIcons';
import { useAppIntl } from '../../i18n';

interface ResultCardProps {
  sample: Sample;
  onDownload: (sample: Sample) => void;
}

/** 卡片渲染的元信息行（物种 · 品种 · 性别 · 阶段 · 个体 #N）。 */
function metaLine(sample: Sample): string {
  return `${sample.species} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage} · #${sample.individual}`;
}

/**
 * 单条结果卡片。
 */
export function ResultCard({ sample, onDownload }: ResultCardProps): JSX.Element {
  const { t } = useAppIntl();
  const navigate = useNavigate();
  const Icon = tissueIcon(sample.tissue);

  return (
    <Card variant="borderless" className="db-result-card" size="small">
      <div className="db-result-card__inner">
        <div className="db-result-card__icon" aria-hidden="true">
          <Icon />
        </div>
        <div className="db-result-card__body">
          <button
            type="button"
            className="db-result-card__id"
            onClick={() => navigate(`/sample/${sample.id}`)}
          >
            {sample.id}
          </button>
          <div className="db-result-card__meta">{metaLine(sample)}</div>
          <div className="db-result-card__tags">
            <Tag className="db-tag">{sample.tissue}</Tag>
            <Tag className="db-tag">{sample.breed}</Tag>
            <Tag className="db-tag db-tag--muted">9 tracks</Tag>
          </div>
        </div>
        <div className="db-result-card__actions">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sample/${sample.id}`)}
          >
            {t('database.action.visualize')}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => onDownload(sample)}
          >
            {t('database.action.download')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
