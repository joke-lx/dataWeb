/**
 * TrackSampleHeader —— 多样本 bigwig 轨道的"轨道级"头部。
 *
 * 职责：
 *  - 与 Lane 平级放在 `.route-content` 内（**不**放在 lane 内部 120px gutter），
 *    这样 chip 行可以拿到整段内容宽度；
 *  - 仅承载标题 + `<SamplePickerButton />`，本身无业务逻辑。
 *
 * 架构位置：被 `/tracks` 路由的 page-level 渲染逻辑调用，
 * 不是被某个 Lane 内部用——这是有意为之（见 JSDoc）。
 */

import type { JSX } from 'react';

import type { Sample } from '../../../api/types';
import { SamplePickerButton } from './SamplePickerButton';

interface TrackSampleHeaderProps {
  /** Track title shown on the left of the header. */
  title: string;
  /** Currently selected sample ids (URL canonical, sorted). */
  sampleIds: string[];
  /** Replace the selection with `next` (single source of truth = URL). */
  onSampleChange: (next: string[]) => void;
  /** Full sample catalog. Empty array means catalog hasn't loaded yet. */
  allSamples: Sample[];
  /** Show a skeleton chip when true (catalog hasn't loaded yet). */
  isCatalogLoading: boolean;
}

/**
 * bigwig 轨道专用 header：标题 + 当前已选样本 chip + "+ Add sample"。
 *
 * 视觉结构（左 → 右）：`[title] ─── [chips × N] ─── [+ Add sample]`
 *
 * @param title 轨道标题
 * @param sampleIds 已选样本 id 列表（URL 单一来源）
 * @param onSampleChange 替换样本集合的回调（直接写 URL）
 * @param allSamples 完整样本目录
 * @param isCatalogLoading true 时显示骨架 chip
 */
export function TrackSampleHeader({
  title,
  sampleIds,
  onSampleChange,
  allSamples,
  isCatalogLoading,
}: TrackSampleHeaderProps): JSX.Element {
  return (
    <div className="track-sample-header" data-ui-overlay="track-sample-header">
      <span className="track-sample-header__title">{title}</span>
      <SamplePickerButton
        sampleIds={sampleIds}
        onChange={onSampleChange}
        allSamples={allSamples}
        isCatalogLoading={isCatalogLoading}
      />
    </div>
  );
}