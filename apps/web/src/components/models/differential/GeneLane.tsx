/**
 * GeneLane — differential viewer 使用的基因注释轨道。
 *
 * 架构位置：
 * - models/differential/ 的私有组件（与 tracks/ 下的 GeneLane 不同源——见 ref1 拒绝 shared/ 的说明）
 * - 渲染委托给 `render-kit/plotly/PlotlyTrack` + `render-kit/plotlyBuilders.buildGene`，本身只负责取数与对齐 viewport
 *
 * 职责：
 * - 根据当前 viewport 拉取 BED 'gene' 注释
 * - 通过 react-query 缓存（30s stale）减少重复请求
 * - 维持与上层 lane 框架一致的 DOM 结构（`.lane` + `.lane-label` + `.lane-content`）
 *
 * 注意：
 * - 与 tracks/ 下的 GeneLane 形态几乎相同，刻意不抽到 shared/ 以避免无意义的耦合
 *   （两个 viewer 的高度/lane 容器 class 等细节可能独立演化）
 */
import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { GeneRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildGene } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

// 与 tracks/ 下的 GeneLane 保持一致；differential 暂未单独定制
const GENE_LANE_HEIGHT = 120;

interface GeneLaneProps {
  /** 覆盖 active sample 的取样来源；缺省回落到 'Brain_BF3' */
  sampleId?: string;
  /** 覆盖 lane 高度（像素）；缺省使用 GENE_LANE_HEIGHT */
  height?: number;
}

/**
 * Gene annotation lane — 内含 backbones + exon 矩形。
 * 与 tracks viewer 形态相同，但属于 differential 模型私有组件。
 */
export function GeneLane({
  sampleId,
  height = GENE_LANE_HEIGHT,
}: GeneLaneProps): JSX.Element {
  const viewport = useViewport();
  // 业务约定的回退 sample，与 DifferentialModel 保持一致
  const resolvedSample = sampleId ?? 'Brain_BF3';

  // queryKey 包含 viewport 坐标，区间变化时 react-query 自动重拉
  // staleTime: 30s 表示短时间内在同一区间内滚动/缩放不会触发新请求
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
    staleTime: 30_000,
  });

  // Plotly trace + layout 完全交给 render-kit；这里只负责把 viewport 喂进去
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
        {/* 轻量 loading / error 标记，叠加在 Plotly canvas 之上 */}
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