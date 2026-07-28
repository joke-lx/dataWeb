/**
 * BedGraphLane —— AB compartment 指数轨道。
 *
 * 职责：
 *  - 拉取指定 sample + trackName 的 bedGraph 区间数据；
 *  - 委托 `plotlyBuilders.buildBedGraph` 生成 Plotly 数据；
 *  - 渲染成统一的 `.lane` 行：左侧 sample 标签 + 右侧 Plotly 图。
 *
 * 视觉特性：A compartment 在零线之上（红色），B 在下（蓝色）——见 `buildBedGraph`。
 *
 * 架构位置：tracks 模型目录下的"单样本 bedGraph"轨道 lane，
 * 通过 `<TracksModel />` 按 kind 分派时调用。
 */

import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { BedGraphRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBedGraph } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BEDGRAPH_LANE_HEIGHT = 150;

interface BedGraphLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * AB compartment 指数轨道：带符号曲线，A 在零线之上、B 在下。
 *
 * @param sampleId 当前样本 id
 * @param trackName bedGraph track 名（目前固定 `'ab'`，但签名留扩展空间）
 * @param title 标题
 * @param height lane 高度（默认 150px）
 */
export function BedGraphLane({
  sampleId,
  trackName,
  title,
  height = BEDGRAPH_LANE_HEIGHT,
}: BedGraphLaneProps): JSX.Element {
  const viewport = useViewport();

  // viewport 进入 queryKey → 平移/缩放会自动触发 refetch；
  // 30s staleTime 防止高频滚轮 zoom 时反复打后端。
  const { data, isLoading, error } = useQuery<BedGraphRecord[]>({
    queryKey: [
      'bedGraph',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'ab'>(sampleId, 'ab', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildBedGraph(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="bedGraph"
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