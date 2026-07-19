import { memo } from 'react';
import type { JSX } from 'react';

interface LaneProps {
  kind: 'hic' | 'bigwig' | 'bedGraph' | 'tadBar' | 'pei' | 'gene';
  title: string;
  sampleId: string;
  trackName?: string;
  height?: number;
}

const HEIGHTS = {
  hic: 480,
  bigwig: 48,
  bedGraph: 36,
  tadBar: 28,
  pei: 36,
  gene: 80,
} as const;

export const Lane = memo(function Lane({
  kind,
  title,
  sampleId,
  trackName,
  height,
}: LaneProps): JSX.Element {
  const laneHeight = height ?? HEIGHTS[kind];

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
          [{kind}] Task E/F will render here
        </span>
      </div>
    </div>
  );
});
