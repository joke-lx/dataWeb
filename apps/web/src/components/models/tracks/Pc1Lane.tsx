/**
 * Pc1Lane —— PC1（第一主成分）信号轨道。
 *
 * 职责：
 *  - 拉取 Hi-C 派生 PC1 数据（`/api/derived/pc1`，含 `source`）；
 *  - 委托 `buildPc1Score` 生成 Plotly：平滑曲线 + 淡填充 + 零线
 *    （与参考站点详细页的 PC1 轨道形态一致，accent 主题色区分语义）；
 *  - 在 lane 角落渲染 `ModelSourceBadge`，标注真实数据 / mock 降级。
 *
 * 架构位置：tracks 模型目录下的"单样本 PC1"lane，由
 * `<GenomeBrowserView />` 在 Hi-C 一体化视图中调用。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import {
  fetchDerivedPc1,
  type DerivedRecordsResponse,
  type DerivedScoreRecord,
} from '../../../api/client';
import { usePanelViewport } from '../../../hooks/usePanelViewport';
import { ModelSourceBadge } from '../../feedback/ModelSourceBadge';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildPc1Score } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const PC1_LANE_HEIGHT = 140;
/** 派生 PC1 的输出分箱数（与 insulation 一致，保证曲线平滑度）。 */
const PC1_N_BINS = 100;

interface Pc1LaneProps {
  sampleId: string;
  trackName?: string;
  title?: string;
  height?: number;
}

/**
 * PC1 信号轨道：平滑曲线 + 淡填充（参考站点详细页形态）。
 *
 * @param sampleId 当前样本 id
 * @param trackName track 名（目前固定 `'pc1'`，缺省取 `'pc1'`）
 * @param title 标题（缺省 `'PC1'`）
 * @param height lane 高度（默认 140px）
 */
export function Pc1Lane({
  sampleId,
  trackName = 'pc1',
  title = 'PC1',
  height = PC1_LANE_HEIGHT,
}: Pc1LaneProps): JSX.Element {
  const viewport = usePanelViewport();

  // viewport + bin 进 queryKey → 平移/缩放/换 bin 触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<
    DerivedRecordsResponse<DerivedScoreRecord>
  >({
    queryKey: [
      'derived-pc1',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    ],
    queryFn: () =>
      fetchDerivedPc1(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        viewport.bin,
        PC1_N_BINS,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // records 结构（chrom/start/end/score）与 BedGraphRecord 完全一致，直接复用 builder。
  const plot = buildPc1Score(data?.records, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="pc1"
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
