/**
 * GeneLane —— Gene model 注释轨道。
 *
 * 职责：
 *  - 拉取 `'gene'` bedGraph 数据（外显子 + 内含子记录）；
 *  - 委托 `buildGene` 生成 Plotly：内含子 backbone + 外显子矩形（多行堆叠）。
 *
 * 与 hic 模型里的 `<GeneLane />` 视觉一致——本组件是 tracks 模型目录下的独立副本，
 * 避免跨模型共享（详见 ref1 关于"拒绝 `models/shared/`"的决策）。
 *
 * 架构位置：tracks 模型目录下的"gene 注释"lane（主/aux 都可能用到）。
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { GeneRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildGene } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const GENE_LANE_HEIGHT = 120;

interface GeneLaneProps {
  /** 覆盖当前样本。 */
  sampleId?: string;
  /** 覆盖 lane 像素高度。 */
  height?: number;
}

/**
 * Gene model 注释轨道：内含子 backbone + 外显子矩形（多行堆叠）。
 *
 * @param sampleId 覆盖默认 sample（缺省走 `'Brain_BF3'` 兜底）
 * @param height lane 高度（默认 120px）
 */
export function GeneLane({
  sampleId,
  height = GENE_LANE_HEIGHT,
}: GeneLaneProps): JSX.Element {
  const viewport = useViewport();
  // gene 注释在数据模型里仍挂在某个 sample 下；缺省时回退到 Brain_BF3——和 hic 模型一致。
  const resolvedSample = sampleId ?? 'Brain_BF3';

  // viewport 进 queryKey → 平移/缩放触发 refetch；30s staleTime 抑制高频抖动。
  const { data, isLoading, error } = useQuery<GeneRecord[]>({
    queryKey: [
      'gene',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'gene'>(resolvedSample, 'gene', viewport.chr, viewport.start, viewport.end),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const plot = buildGene(data, viewport, 'Gene model', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="gene"
        data-track-name="gene"
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