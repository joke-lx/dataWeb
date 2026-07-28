/**
 * SamplePickerButton —— 多样本叠加的"快速操作"控件。
 *
 * 职责：
 *  - 在轨道头部显示当前已选样本的 chip 行（每个 chip 左侧带 tissue 颜色）；
 *  - "×"按钮立即移除单个样本（绕过草稿，直接 onChange → URL）；
 *  - "+ Add sample" 按钮切换 popover 显示状态（嵌入 `<SamplePicker />`）。
 *
 * 两条移除路径：
 *  - chip 行 × —— 立即生效（适合"移除单个"快操作）；
 *  - Picker 的 Apply —— 批量生效（适合"探索多个候选"）。
 *
 * 架构位置：被 `<TrackSampleHeader />` 调用，是 chip 行 + 弹层的容器。
 */

import { useMemo, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent } from 'react';

import type { Sample } from '../../../api/types';
import { colorForTissue } from './sampleColors';
import { SamplePicker } from './SamplePicker';
import './tracks.css';

interface SamplePickerButtonProps {
  /** 当前选中的样本 id 列表（URL 规范，已排序）。 */
  sampleIds: string[];
  /** 将选中集合替换为 next（单一数据源 = URL）。 */
  onChange: (next: string[]) => void;
  /** 完整样本目录（用于分组 + chip 标签）。加载中时可能为空。 */
  allSamples: Sample[];
  /** 为 true 时显示骨架 chip（catalog 尚未加载完）。 */
  isCatalogLoading: boolean;
}

/**
 * 多样本叠加头部控件：chip 行 + 弹层触发器。
 *
 * @param sampleIds 已选样本 id 列表（URL 单一来源）
 * @param onChange 替换样本集合的回调（直接写 URL）
 * @param allSamples 完整样本目录（用于 tissue 分组与 chip 颜色）
 * @param isCatalogLoading true 时显示骨架 chip
 */
export function SamplePickerButton({
  sampleIds,
  onChange,
  allSamples,
  isCatalogLoading,
}: SamplePickerButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  // 把 URL 中的 id 列表映射回 Sample 对象，跳过 catalog 还没载入的项。
  // 把 URL 中的 id 列表映射回 Sample 对象，跳过 catalog 还没载入的项。
  const selected = useMemo<Sample[]>(() => {
    return sampleIds
      .map((id) => allSamples.find((s) => s.id === id))
      .filter((s): s is Sample => s !== undefined);
  }, [sampleIds, allSamples]);

  // 阻止冒泡到 d3-zoom——否则在 popover 里滚轮或按下会触发基因组视口平移。
  // 阻止冒泡到 d3-zoom——否则在 popover 里滚轮或按下会触发基因组视口平移。
  const stopD3 = (e: ReactMouseEvent | WheelEvent): void => {
    e.stopPropagation();
  };

  return (
    <div
      className="sample-picker-row"
      data-ui-overlay="sample-picker"
      onWheelCapture={stopD3}
      onMouseDownCapture={stopD3}
    >
      <div className="sample-picker-chips">
        {isCatalogLoading && sampleIds.length === 0 ? (
          <span className="sample-chip sample-chip--loading">Loading…</span>
        ) : (
          selected.map((s) => {
            const c = colorForTissue(s.tissue);
            return (
              <span
                key={s.id}
                className="sample-chip sample-chip--active"
                style={{ borderLeftColor: c.line }}
                title={`${s.tissue} · ${s.breed} · ${s.sex}`}
              >
                <span className="sample-chip__swatch" style={{ background: c.line }} />
                <span className="sample-chip__id">{s.id}</span>
                <button
                  type="button"
                  className="sample-chip__remove"
                  aria-label={`Remove ${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(sampleIds.filter((x) => x !== s.id));
                  }}
                >
                  ×
                </button>
              </span>
            );
          })
        )}
        {sampleIds.length === 0 && !isCatalogLoading && (
          <span className="sample-picker-empty">No samples selected</span>
        )}
      </div>
      <button
        type="button"
        className="sample-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '×' : '+ Add sample'}
      </button>
      {open && (
        <SamplePicker
          sampleIds={sampleIds}
          allSamples={allSamples}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}