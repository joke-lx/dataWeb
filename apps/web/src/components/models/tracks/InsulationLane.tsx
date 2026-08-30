/**
 * InsulationLane —— Insulation Score（边界强度）轨道。
 *
 * 职责：
 *  - 拉取 Hi-C 派生 insulation 数据（`/api/derived/insulation`，含 `source`）；
 *  - 委托 `buildInsulationScore` 生成 Plotly：平滑曲线 + 淡填充（与 demo 对齐）；
 *  - 在 lane 角落渲染 `ModelSourceBadge`，标注真实数据 / mock 降级。
 *
 * 架构位置：tracks 模型目录下的"单样本 IS"lane，由 `<TracksModel />` 在
 * `kind === 'is'` 分支调用。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import {
  fetchDerivedInsulation,
  type DerivedRecordsResponse,
  type DerivedScoreRecord,
} from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildInsulationScore } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const INSULATION_LANE_HEIGHT = 150;
/** 派生 insulation 的输出分箱数（后端默认 100，与 demo 密度一致）。 */
const INSULATION_N_BINS = 100;

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

  // viewport + bin 进 queryKey → 平移/缩放/换 bin 触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<
    DerivedRecordsResponse<DerivedScoreRecord>
  >({
    queryKey: [
      'derived-insulation',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    ],
    queryFn: () =>
      fetchDerivedInsulation(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        viewport.bin,
        INSULATION_N_BINS,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // records 结构（chrom/start/end/score）与 BedGraphRecord 完全一致，直接复用 builder。
  const plot = buildInsulationScore(data?.records, viewport, title, height);

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
        <ModelSourceBadge source={data?.source} />
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