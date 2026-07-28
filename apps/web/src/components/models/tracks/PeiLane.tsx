/**
 * PeiLane —— Promoter-Enhancer Interaction 锚点轨道。
 *
 * 职责：
 *  - 拉取 `'pei'` bedGraph 数据（每条记录代表一对 P-E 锚点）；
 *  - 委托 `buildPei` 把每个交互画成跨越 lane 的二次弧线。
 *
 * 视觉特性：每条 PEI 一根"桥"——从 interval start 跨到 interval end，
 * 弧线高度由 lane 高度决定，不带悬停交互（hover 由 Plotly 默认）。
 *
 * 架构位置：tracks 模型目录下的"单样本 PEI"lane。
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildPei } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const PEI_LANE_HEIGHT = 180;

interface PeiLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * PEI（Promoter-Enhancer Interaction）锚点轨道：跨 lane 的二次弧线。
 *
 * @param sampleId 当前样本 id
 * @param trackName track 名（目前固定 `'pei'`）
 * @param title 标题
 * @param height lane 高度（默认 180px）
 */
export function PeiLane({
  sampleId,
  trackName,
  title,
  height = PEI_LANE_HEIGHT,
}: PeiLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 进 queryKey → 平移/缩放触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<PeiRecord[]>({
    queryKey: [
      'pei',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'pei'>(sampleId, 'pei', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildPei(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="pei"
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