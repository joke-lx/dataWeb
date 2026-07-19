import { useRef } from 'react';
import type { JSX } from 'react';

import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useViewport } from '../../store/viewport';
import { Lane } from './Lane';
import './stage.css';

const SAMPLE_ID = 'Brain_BF3';

const LANE_CONFIGS = [
  { kind: 'hic', title: 'Hi-C matrix' },
  { kind: 'bigwig', title: 'RNA-seq', trackName: 'rna_seq' },
  { kind: 'bedGraph', title: 'AB index', trackName: 'ab' },
  { kind: 'tadBar', title: 'TAD boundary', trackName: 'tad' },
  { kind: 'pei', title: 'PEI anchors', trackName: 'pei' },
  { kind: 'gene', title: 'Gene model', trackName: 'gene' },
] as const;

export function Stage(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  useD3Zoom(stageRef);
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);
  const bin = useViewport((state) => state.bin);

  return (
    <main className="stage" ref={stageRef}>
      <header className="stage-header">
        <span className="region">
          {chr}:{start.toLocaleString()}-{end.toLocaleString()}
        </span>
        <span className="bin">bin {bin.toLocaleString()} bp</span>
      </header>
      <div className="stage-content">
        {LANE_CONFIGS.map((lane) => (
          <Lane
            key={lane.kind}
            {...lane}
            sampleId={SAMPLE_ID}
            trackName={'trackName' in lane ? lane.trackName : undefined}
          />
        ))}
      </div>
    </main>
  );
}
