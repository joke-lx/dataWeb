/**
 * HiCMatrix —— Hi-C 接触矩阵 lane（tracks 模型专用）。
 *
 * 职责：
 *  - 拉取当前视口范围内的 Hi-C 矩阵；
 *  - 自适应选择合适的 bin 大小（不超过 `MAX_MATRIX_DIM`）；
 *  - 渲染 ColormapBar + WebGL 渲染的 `<HiCMatrix2D />`。
 *
 * 与 hic 模型下的同名组件视觉一致——本组件是 tracks 模型目录下的独立副本，
 * 避免跨模型共享（详见 ref1 决策）。
 *
 * 架构位置：被 `<LoopTrack />` 直接调用；track 路由里走 `kind: 'hic'` 间接走 LoopTrack。
 */

import { useState } from 'react';
import type { JSX } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchHicMatrix, type HicMatrixResponse } from '../../../api/client';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { useViewport } from '../../../store/viewport';
import { ColormapBar, type ColormapName } from '../../render-kit/hic/ColormapBar';
import { HiCMatrix2D } from '../../render-kit/hic/HiCMatrix2D';
import '../../render-kit/hic/hic.css';

const MAX_MATRIX_DIM = 512;
const HIC_LANE_HEIGHT = 480;

interface HiCMatrixProps {
  /** 覆盖当前样本。 */
  sampleId?: string;
  /** 覆盖 lane 像素高度。 */
  height?: number;
}

/**
 * Hi-C 接触矩阵 lane：左侧 ColormapBar + WebGL 渲染的 2D 热图。
 *
 * bin 自适应：保证矩阵像素不超过 `MAX_MATRIX_DIM`，bin 向上对齐到 1000 的倍数
 * （匹配后端 cache key 的离散化粒度）。
 *
 * @param sampleId 覆盖默认 sample（缺省走 activeSample，再缺省 Brain_BF3）
 * @param height lane 高度（默认 480px，LoopTrack 用 320px）
 */
export function HiCMatrix({
  sampleId: sampleIdOverride,
  height = HIC_LANE_HEIGHT,
}: HiCMatrixProps): JSX.Element {
  const viewport = useViewport();
  const activeSample = useActiveSample();
  const sampleId = sampleIdOverride ?? activeSample ?? 'Brain_BF3';

  // 局部 colormap 状态：本 lane 内的 colormap 选择不写 URL，
  // 与 sample / viewport 等 URL-canonical state 解耦。
  const [colorMap, setColorMap] = useState<ColormapName>('ref');

  const viewportWidth = viewport.end - viewport.start;
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  // bin 必须不小于当前 viewport 自带的 bin（防止过采样），同时向上对齐 1000 倍数
  // ——后端按这个粒度缓存，命中 cache 比精确粒度更省时。
  const hicBin = Math.max(
    viewport.bin,
    Math.ceil(targetBin / 1000) * 1000,
  );

  // hicBin 进 queryKey → zoom 触发不同 bin 时重新拉数据。
  const { data, isLoading, error } = useQuery<HicMatrixResponse>({
    queryKey: [
      'hic',
      sampleId,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
      hicBin,
    ],
    queryFn: () =>
      fetchHicMatrix(
        sampleId,
        viewport.chr,
        viewport.start,
        viewport.end,
        hicBin,
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-title">Hi-C matrix</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="hic-lane"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <ColormapBar
          vmin={data?.vmin ?? 0}
          vmax={data?.vmax ?? 1}
          colorMap={colorMap}
          onChange={setColorMap}
        />
        <HiCMatrix2D
          sampleId={sampleId}
          data={data}
          loading={isLoading}
          error={error}
          colorMap={colorMap}
          vmin={data?.vmin}
          vmax={data?.vmax}
          bin={hicBin}
          height={height - 32}
        />
      </div>
    </div>
  );
}