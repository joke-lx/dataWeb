/**
 * SvLane —— Structural Variants（结构变异）轨道。
 *
 * 职责：
 *  - 拉取 SV 数据（DEL / DUP / INV / TRA 四种 kind）；
 *  - 委托 `buildSv` 生成 Plotly：按 kind 上色的 marker，文字标签同色。
 *
 * 仅在 aux 路径上使用（主轨道没有 SV 入口），由 `<TracksModel />` 在
 * `kind === 'sv'` 分支调用。
 *
 * 架构位置：tracks 模型目录下的"单样本 SV"lane。
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchSV, type SVRecord } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildSv } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const SV_LANE_HEIGHT = 120;

interface SvLaneProps {
  sampleId: string;
  title: string;
  height?: number;
}

/**
 * 结构变异轨道：按 kind 上色的 marker，DEL/DUP/INV/TRA 文字标签同色。
 *
 * @param sampleId 当前样本 id
 * @param title 标题
 * @param height lane 高度（默认 120px）
 */
export function SvLane({
  sampleId,
  title,
  height = SV_LANE_HEIGHT,
}: SvLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 进 queryKey → 平移/缩放触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<SVRecord[]>({
    queryKey: [
      'sv',
      sampleId,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchSV(sampleId, viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildSv(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="sv"
        data-track-name="sv"
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