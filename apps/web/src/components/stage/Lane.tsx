import { memo, useState } from 'react';
import type { JSX } from 'react';

import { HiCMatrix2D } from '../hic/HiCMatrix2D';
import { ColormapBar, type ColormapName } from '../hic/ColormapBar';
import '../hic/hic.css';

export type LinearKind = 'hic' | 'bigwig' | 'bedGraph' | 'tadBar' | 'pei' | 'gene';

interface LaneProps {
  kind: LinearKind;
  title: string;
  sampleId: string;
  trackName?: string;
  height?: number;
}

const HEIGHTS: Record<LinearKind, number> = {
  hic: 480,
  bigwig: 48,
  bedGraph: 36,
  tadBar: 28,
  pei: 36,
  gene: 80,
};

export const Lane = memo(function Lane({
  kind,
  title,
  sampleId,
  trackName,
  height,
}: LaneProps): JSX.Element {
  const laneHeight = height ?? HEIGHTS[kind];
  const [colorMap, setColorMap] = useState<ColormapName>('rdbu');
  // vmin/vmax are surfaced for HiC; future phases may sync via api response headers
  // or a separate /api/hic/range endpoint that returns the live clip.
  const vmin = 0;
  const vmax = 6;

  if (kind === 'hic') {
    return (
      <div className="lane" style={{ height: `${laneHeight}px` }}>
        <div className="lane-label">
          <span className="lane-title">{title}</span>
          <span className="lane-sample">{sampleId}</span>
        </div>
        <div
          className="lane-content"
          data-kind={kind}
          data-track-name={trackName}
          style={{ display: 'block' }}
        >
          <HiCMatrix2D sampleId={sampleId} height={laneHeight - 32} />
          <ColormapBar
            vmin={vmin}
            vmax={vmax}
            colorMap={colorMap}
            onChange={setColorMap}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="lane" style={{ height: `${laneHeight}px` }}>
      <div className="lane-label">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind={kind}
        data-track-name={trackName}
      >
        <span className="placeholder">
          [{kind}] Task E will render here
        </span>
      </div>
    </div>
  );
});