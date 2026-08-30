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
 *
 * Activity proxy (Hi-C 派生)：当 trackName 属于 `ACTIVITY_PROXY_TRACKS`（RNA-seq /
 * H3K4me3 / H3K27ac），我们没有真实测序数据，但 Hi-C 的 A/B compartment 与表达 /
 * 组蛋白修饰 / 开放性有强相关 —— 用 `fetchDerivedActivity` 给一个 [0, 1] 区间
 * 信号，UI 加 `ModelSourceBadge source="ab_proxy"` 标注。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig, fetchDerivedActivity } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBigwig } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BIGWIG_LANE_HEIGHT = 180;

/** Activity proxy 适用的 track name —— Hi-C A/B 派生的表达/ChIP/ATAC 代理。 */
const ACTIVITY_PROXY_TRACKS = new Set(['rna_seq', 'h3k4me3', 'h3k27ac']);
const isActivityProxy = (t: string) => ACTIVITY_PROXY_TRACKS.has(t);

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

  const useActivity = isActivityProxy(trackName);

  // bins 进 queryKey——zoom/pan 触发 bins 变化 → 重新拉数据。
  // activity 路径返回 {values: number[], source}；bigwig 路径返回 {values: Float32Array, vmin, vmax}。
  // 显式标 union 让 useQuery 不挑错。
  type BigwigData =
    | { values: Float32Array; vmin: number; vmax: number; source?: undefined }
    | { values: number[]; source: string };
  const { data, isLoading, error } = useQuery<BigwigData>({
    queryKey: useActivity
      ? ['derived-activity', sampleId, trackName, viewport.chr, viewport.start, viewport.end, bins]
      : ['bigwig', sampleId, trackName, viewport.chr, viewport.start, viewport.end, bins],
    queryFn: () =>
      useActivity
        ? fetchDerivedActivity(
            sampleId,
            viewport.chr,
            viewport.start,
            viewport.end,
            viewport.bin,
            bins,
          ).then<BigwigData>((d) => ({
            values: d.records.map((r) => r.score),
            source: d.source,
          }))
        : fetchBigwig(
            sampleId,
            trackName,
            viewport.chr,
            viewport.start,
            viewport.end,
            bins,
          ),
    enabled: !!trackName,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // buildBigwig 接受 Float32Array；activity 返回 number[]，传之前转 Float32Array。
  const plotValues = data
    ? data.values instanceof Float32Array
      ? data.values
      : new Float32Array(data.values)
    : undefined;
  const plot = buildBigwig(plotValues, viewport, trackName, height);
  const source = data && 'source' in data ? data.source : undefined;

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind={useActivity ? 'activity' : 'bigwig'}
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        {useActivity && <ModelSourceBadge source={source ?? 'ab_proxy'} />}
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