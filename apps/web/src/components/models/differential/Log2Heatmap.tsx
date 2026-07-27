import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import {
  fetchDifferentialHic,
  type HicMatrixResponse,
} from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { ColormapBar } from '../../render-kit/hic/ColormapBar';
import { HiCMatrix2D } from '../../render-kit/hic/HiCMatrix2D';
import './differential.css';

const LOG2_HEATMAP_HEIGHT = 420;

interface Log2HeatmapProps {
  sampleA: string;
  sampleB: string;
}

/**
 * Differential Hi-C log2 heatmap — horizontal colormap bar + WebGL
 * heatmap rendered with the white-centered diverging colormap.
 */
export function Log2Heatmap({ sampleA, sampleB }: Log2HeatmapProps): JSX.Element {
  const viewport = useViewport();
  const [matrix, setMatrix] = useState<HicMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchDifferentialHic(
      sampleA,
      sampleB,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
    )
      .then((res) => {
        if (!ctrl.signal.aborted) setMatrix(res);
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [sampleA, sampleB, viewport.chr, viewport.start, viewport.end, viewport.bin]);

  return (
    <div className="diff-heatmap-wrapper">
      <ColormapBar
        vmin={matrix?.vmin ?? -1}
        vmax={matrix?.vmax ?? 1}
        mode="differential"
        colorMap="rdbu"
        horizontal
      />
      <div className="diff-heatmap-container">
        <HiCMatrix2D
          sampleA={sampleA}
          sampleB={sampleB}
          variant="differential"
          data={matrix ?? undefined}
          loading={loading}
          error={error}
          bin={viewport.bin}
          height={LOG2_HEATMAP_HEIGHT}
        />
      </div>
    </div>
  );
}