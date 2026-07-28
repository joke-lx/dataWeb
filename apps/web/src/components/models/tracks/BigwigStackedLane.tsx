/**
 * BigwigStackedLane —— 多样本 bigwig 轨道 lane。
 *
 * 职责：
 *  - 用 `useQueries` 并行拉取 N 个样本的 bigwig 数据；
 *  - N=1 时退化为单样本 `buildBigwig`（避免无意义的切片几何）；
 *  - N≥2 时用 `buildBigwigStacked` 生成 demo 风格的多切片布局；
 *  - lane 总高按样本数线性增长（`70 * N + 30`），保证每个切片至少有 70px。
 *
 * 颜色来源：通过 `sampleMeta` 解析 tissue → `colorForTissue`；缺失 meta 时
 * 用本地 fallback 中性灰（仅单样本时可能有 meta 缺失，因为 SamplePickerButton
 * 一定会为已选样本提供 meta）。
 *
 * 架构位置：tracks 模型目录下的"多样本 bigwig"lane，被 `<TracksModel />`
 * 在主轨道 `kind === 'bigwig'` 分支调用。
 */

import { useQueries } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig } from '../../../api/client';
import type { Sample } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import {
  buildBigwig,
} from '../../render-kit/plotlyBuilders';
import { buildBigwigStacked, type BigwigSeries } from './BigwigStacked';
import { colorForTissue, type SampleColor } from './sampleColors';
import '../../render-kit/lane.css';

interface BigwigStackedProps {
  sampleIds: string[];
  sampleMeta?: Sample[];
  trackName: string;
  title: string;
  groupLabel?: string;
  highlightBands?: Array<{ start: number; end: number }>;
  height?: number;
}

/**
 * 多样本 bigwig lane：每个样本一个水平切片（独立 y 轴），共享 x 轴。
 * N=1 时退回 `buildBigwig` 单样本布局。
 *
 * @param sampleIds 样本 id 列表（URL 单一来源）
 * @param sampleMeta 样本元数据（用于 tissue→color 解析；可选）
 * @param trackName bigwig track 名（如 `'rna_seq'`）
 * @param title lane 标题
 * @param groupLabel 左侧旋转组名（缺省 = title）
 * @param highlightBands 可选高亮区间
 * @param height 期望最小高度（实际高度会按样本数增长）
 */
export function BigwigStacked({
  sampleIds,
  sampleMeta,
  trackName,
  title,
  groupLabel,
  highlightBands,
  height,
}: BigwigStackedProps): JSX.Element {
  const viewport = useViewport();
  // bin 数随 viewport 宽度线性变化：50~800 之间。下限 50 防过疏，上限 800 防请求爆炸。
  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  // 用 useQueries 并行拉取——多个 query 共享 React Query 的 cache / dedup / retry 策略。
  const queries = useQueries({
    queries: sampleIds.map((id) => ({
      queryKey: [
        'bigwig-stacked',
        id,
        trackName,
        viewport.chr,
        viewport.start,
        viewport.end,
        bins,
      ],
      queryFn: () =>
        fetchBigwig(
          id,
          trackName,
          viewport.chr,
          viewport.start,
          viewport.end,
          bins,
        ),
      enabled: !!trackName,
      staleTime: 30_000,
    })),
  });

  // 缺 meta 时本地 fallback（与 sampleColors.ts 的 FALLBACK 保持一致；这里显式重写避免循环依赖）
  const fallback: SampleColor = {
    line: '#666666',
    fill: 'rgba(102, 102, 102, 0.60)',
  };
  // 按 sampleIds 顺序构造 series——保证最终 Plotly 切片顺序 = URL 选择顺序。
  const series: BigwigSeries[] = sampleIds.map((id, i) => {
    const meta = sampleMeta?.[i];
    const c = meta ? colorForTissue(meta.tissue) : fallback;
    return {
      id,
      values: queries[i]?.data?.values,
      line: c.line,
      fill: c.fill,
    };
  });

  // Single-sample → single bigwig; ≥2 samples → demo-style stacked slices.
  // lane 高度随样本数增长：每片最少 70px，固定 30px 余量（顶部标题 + 底部 margin）。
  const stackedLaneHeight =
    series.length === 1
      ? height ?? 180
      : Math.max(height ?? 180, 70 * series.length + 30);
  const plot =
    series.length === 1
      ? buildBigwig(series[0].values, viewport, title, stackedLaneHeight)
      : buildBigwigStacked(
          series,
          viewport,
          title,
          stackedLaneHeight,
          groupLabel ?? title,
          highlightBands,
        );

  // 任一 query 失败 → 在右上角显示错误标记（但不阻断其它已就绪的 trace）
  const overlayError = queries.find((q) => q.error)?.error ?? null;
  const overlayLoading = queries.some((q) => q.isLoading);

  return (
    <div
      className="lane lane--stacked"
      style={{ height: `${stackedLaneHeight}px` }}
    >
      <div className="lane-label lane-label--stacked">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">
          {sampleIds.length > 2
            ? `${sampleIds.slice(0, 2).join(', ')} +${sampleIds.length - 2}`
            : sampleIds.join(', ')}
        </span>
      </div>
      <div
        className="lane-content"
        data-kind="bigwig"
        data-track-name={trackName}
      >
        {series.every((s) => !s.values) ? (
          <span className="placeholder">No samples selected</span>
        ) : (
          <PlotlyTrack data={plot.data} layout={plot.layout} height={stackedLaneHeight} />
        )}
        {overlayLoading && <span className="track-loading">…</span>}
        {overlayError && (
          <span className="track-error" title={overlayError.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}