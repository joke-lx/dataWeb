/**
 * InsulationLane —— Insulation Score（边界强度）轨道。
 *
 * 职责：
 *  - 拉取 `'is'` bedGraph 数据；
 *  - 委托 `buildInsulationScore` 生成 Plotly：平滑曲线 + 淡填充（与 demo 对齐）。
 *
 * 架构位置：tracks 模型目录下的"单样本 IS"lane，由 `<TracksModel />` 在
 * `kind === 'is'` 分支调用。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { BedGraphRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildInsulationScore } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const INSULATION_LANE_HEIGHT = 150;

interface InsulationLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * Insulation Score 轨道：平滑曲线 + 淡填充（与 demo.html 视觉一致）。
 *
 * @param sampleId 当前样本 id
 * @param trackName track 名（目前固定 `'is'`）
 * @param title 标题
 * @param height lane 高度（默认 150px）
 */
export function InsulationLane({
  sampleId,
  trackName,
  title,
  height = INSULATION_LANE_HEIGHT,
}: InsulationLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 进 queryKey → 平移/缩放触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<BedGraphRecord[]>({
    queryKey: [
      'is',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'is'>(sampleId, 'is', viewport.chr, viewport.start, viewport.end),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const plot = buildInsulationScore(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="is"
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