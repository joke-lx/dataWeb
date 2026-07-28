/**
 * Hi-C 模型的业务轨道容器，负责把样本与基因组视口转换为矩阵查询，并组合色标和通用 WebGL 渲染器。
 * 它刻意留在 models 层：数据获取、分箱策略和默认样本属于业务决策，而像素绘制下沉到 render-kit。
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchHicMatrix, type HicMatrixResponse } from '../../../api/client';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { useViewport } from '../../../store/viewport';
import { ColormapBar, type ColormapName } from '../../render-kit/hic/ColormapBar';
import { HiCMatrix2D } from '../../render-kit/hic/HiCMatrix2D';
import '../../render-kit/hic/hic.css';

const MAX_MATRIX_DIM = 512;
const HIC_LANE_HEIGHT = 480;

interface HiCMatrixProps {
  /** Override the active sample. */
  sampleId?: string;
  /** Override the lane height in pixels. */
  height?: number;
}

/**
 * 渲染视口感知的 Hi-C 矩阵业务轨道。
 *
 * @param props - 轨道配置；`sampleId` 可覆盖全局活动样本，`height` 控制整条 lane 的像素高度。
 * @returns 包含色标、WebGL 矩阵以及加载/错误状态的轨道元素。
 */
export function HiCMatrix({
  sampleId: sampleIdOverride,
  height = HIC_LANE_HEIGHT,
}: HiCMatrixProps): JSX.Element {
  const viewport = useViewport();
  const activeSample = useActiveSample();
  const sampleId = sampleIdOverride ?? activeSample ?? 'Brain_BF3';

  const [colorMap, setColorMap] = useState<ColormapName>('ref');

  const viewportWidth = viewport.end - viewport.start;
  // 以 512×512 作为显存与辨识度上限，并向上对齐到服务端支持的 kb 粒度；
  // 同时不得细于用户视口请求的 bin，避免缩放时拉取无法显示的过量矩阵单元。
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  const hicBin = Math.max(
    viewport.bin,
    Math.ceil(targetBin / 1000) * 1000,
  );

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