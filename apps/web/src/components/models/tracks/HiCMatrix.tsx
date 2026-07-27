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
 * Hi-C matrix lane — colormap selector + WebGL-rendered 2D heatmap.
 *
 * Owns its own viewport-aware query (so the matrix bin follows zoom) and
 * delegates rendering to the WebGL-backed `HiCMatrix2D`.
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