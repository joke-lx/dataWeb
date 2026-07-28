/**
 * BigwigLane —— 单样本 bigwig 信号轨道。
 *
 * 职责：
 *  - 根据当前 viewport 宽度自适应计算分箱数（bins），保证 lane 在缩放时密度合适；
 *  - 拉取指定 sample + trackName 的 bigwig 数据；
 *  - 委托 `buildBigwig` 生成 Plotly trace（与 multi-sample 的 `BigwigStacked` 区分）。
 *
 * 与 `BigwigStacked` 的关系：仅一个样本时使用本组件（叠加版对 N=1 退化成单轴），
 * 由 `<TracksModel />` 在 `aux` 渲染分支里选本组件。
 *
 * 架构位置：aux 路径上唯一的 bigwig lane；主轨道走 `BigwigStacked`。
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBigwig } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BIGWIG_LANE_HEIGHT = 180;

interface BigwigLaneProps {
  /** 当前样本 id。 */
  sampleId: string;
  /** Track 名（如 "rna_seq"）。 */
  trackName: string;
  /** 覆盖 lane 像素高度。 */
  height?: number;
}

/**
 * 单样本 bigwig 轨道：RNA-seq / 组蛋白修饰（ChIP-seq）等连续信号。
 *
 * @param sampleId 当前样本 id
 * @param trackName 轨道名（如 `'rna_seq'`、`'h3k4me3'` 等）
 * @param height lane 高度（默认 180px）
 */
export function BigwigLane({
  sampleId,
  trackName,
  height = BIGWIG_LANE_HEIGHT,
}: BigwigLaneProps): JSX.Element {
  const viewport = useViewport();
  // bin 数随 viewport 宽度线性增减：每 1kb 视口宽度 → 1 bin，
  // 下限 50 防止极窄视口丢失细节，上限 800 避免请求体过大。
  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  // bins 进 queryKey——zoom/pan 触发 bins 变化 → 重新拉数据。
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'bigwig',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      bins,
    ],
    queryFn: () =>
      fetchBigwig(
        sampleId,
        trackName,
        viewport.chr,
        viewport.start,
        viewport.end,
        bins,
      ),
    enabled: !!trackName,
    staleTime: 30_000,
  });

  const plot = buildBigwig(data?.values, viewport, trackName, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="bigwig"
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        {isLoading && <span className="track-loading">…</span>}
        {error && (
          <span className="track-error" title={error.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}