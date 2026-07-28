/**
 * TadBar —— TAD（Topologically Associating Domain）边界条轨道。
 *
 * 职责：
 *  - 拉取 `'tad'` bedGraph 数据；
 *  - 委托 `buildTadBar` 把每个 TAD 区间画成"满高度矩形条"，跨整条 lane。
 *
 * 视觉特性：每个 TAD 一根满高矩形（沿基因组轴），没有 lane 上下的空白——
 * 这与 hic 模型里 `<TadBar />` 的视觉一致。
 *
 * 架构位置：tracks 模型目录下的"单样本 TAD"lane。
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { TadRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildTadBar } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const TAD_LANE_HEIGHT = 120;

interface TadBarProps {
  /** Override the active sample. */
  sampleId?: string;
  /** Override the lane height in pixels. */
  height?: number;
}

/**
 * TAD 边界条轨道：每个 domain 区间一根满高矩形条。
 *
 * @param sampleId 覆盖默认 sample（缺省走 `'Brain_BF3'` 兜底）
 * @param height lane 高度（默认 120px）
 */
export function TadBar({
  sampleId,
  height = TAD_LANE_HEIGHT,
}: TadBarProps): JSX.Element {
  const viewport = useViewport();
  // gene / tad 等"非样本特异"轨道在缺省 sample 时回退到 Brain_BF3——见 hic 模型同款约定。
  const resolvedSample = sampleId ?? 'Brain_BF3';

  // viewport 进 queryKey → 平移/缩放触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<TadRecord[]>({
    queryKey: [
      'tadBar',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'tad'>(resolvedSample, 'tad', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildTadBar(data, viewport, 'TAD boundary', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="tadBar"
        data-track-name="tad"
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