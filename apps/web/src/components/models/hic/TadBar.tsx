/**
 * Hi-C 模型中的 TAD 区间业务轨道，连接视口感知的数据查询与通用 Plotly 形状渲染能力。
 * 该文件存在于 models 层，以集中默认样本、缓存键和后端 track 名称，避免这些约定泄漏到 render-kit。
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
  /** 覆盖当前样本。 */
  sampleId?: string;
  /** 覆盖 lane 像素高度。 */
  height?: number;
}

/**
 * 渲染与当前基因组视口同步的 TAD 区间轨道。
 *
 * @param props - 可选的样本覆盖值与 lane 像素高度；未传样本时使用 Hi-C 默认样本。
 * @returns 将每个 domain 映射为全高矩形，并带异步状态提示的 Plotly 轨道。
 */
export function TadBar({
  sampleId,
  height = TAD_LANE_HEIGHT,
}: TadBarProps): JSX.Element {
  const viewport = useViewport();
  const resolvedSample = sampleId ?? 'Brain_BF3';

  const { data, isLoading, error } = useQuery<TadRecord[]>({
    // 将完整视口纳入键，避免平移或缩放时沿用旧窗口的 domain 边界。
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