/**
 * Hi-C 模型中的基因注释业务轨道，按当前视口请求 BED 数据，再交给通用 Plotly 构建器与渲染器。
 * 单独保留该适配层，是为了让 render-kit 不依赖样本、查询键或后端轨道命名等业务知识。
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
 * 渲染与当前基因组视口同步的基因注释轨道。
 *
 * @param props - 可选的样本覆盖值与 lane 像素高度；未传样本时使用 Hi-C 默认样本。
 * @returns 由内含子骨架和外显子矩形组成，并带异步状态提示的 Plotly 轨道。
 */
export function GeneLane({
  sampleId,
  height = GENE_LANE_HEIGHT,
}: GeneLaneProps): JSX.Element {
  const viewport = useViewport();
  const resolvedSample = sampleId ?? 'Brain_BF3';

  const { data, isLoading, error } = useQuery<GeneRecord[]>({
    // 将完整视口纳入键，防止平移或缩放后短暂复用上一窗口的注释。
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