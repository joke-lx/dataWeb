/**
 * OverviewSection — Sample 详情页概览区块。
 *
 * 职责：用 antd Descriptions 展示样本元数据（ID / 物种 / 组织 / 品种 /
 * 性别 / 个体 / 发育阶段 / 参考基因组）。compare 模式下并排渲染两份。
 */

import type { JSX } from 'react';
import { Descriptions } from 'antd';

import type { Sample } from '../../api/types';
import { useAppIntl } from '../../i18n';

interface OverviewSectionProps {
  sample: Sample;
  partner?: Sample;
}

/** 单个样本的元数据项。 */
function itemsFor(sample: Sample): Array<{ key: string; label: string; children: React.ReactNode }> {
  const assembly = sample.species === 'pig' ? 'Sscrofa11.1' : 'GRCg6a';
  return [
    { key: 'id', label: 'ID', children: sample.id },
    { key: 'species', label: 'Species', children: `${sample.species} · ${assembly}` },
    { key: 'tissue', label: 'Tissue', children: sample.tissue },
    { key: 'breed', label: 'Breed', children: sample.breed },
    { key: 'sex', label: 'Sex', children: sample.sex },
    { key: 'individual', label: 'Individual', children: `#${sample.individual}` },
    { key: 'stage', label: 'Dev stage', children: sample.dev_stage },
  ];
}

/**
 * 概览区块。
 */
export function OverviewSection({ sample, partner }: OverviewSectionProps): JSX.Element {
  const { t } = useAppIntl();
  if (partner) {
    return (
      <div className="sample-overview sample-overview--compare">
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} items={itemsFor(sample)} title={sample.id} />
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} items={itemsFor(partner)} title={partner.id} />
      </div>
    );
  }
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, sm: 2, md: 3 }}
      items={itemsFor(sample)}
      title={t('sample.metadata.overview')}
    />
  );
}
