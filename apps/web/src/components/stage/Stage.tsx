import { useRef } from 'react';
import type { JSX } from 'react';

import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useViewport } from '../../store/viewport';
import { CrosshairLayer } from '../overlay/CrosshairLayer';
import { Lane } from './Lane';
import './stage.css';

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
        <CrosshairLayer />
        <Lane kind="hic" title="Hi-C matrix" />
        <Lane kind="bigwig" title="RNA-seq" trackName="rna_seq" />
        <Lane
          kind="bedGraph"
          title="AB index"
          trackName="ab"
          bedKind="ab"
        />
        <Lane
          kind="tadBar"
          title="TAD boundary"
          trackName="tad"
          bedKind="tad"
        />
        <Lane
          kind="pei"
          title="PEI anchors"
          trackName="pei"
          bedKind="pei"
        />
        <Lane
          kind="gene"
          title="Gene model"
          trackName="gene"
          bedKind="gene"
        />
      </div>
    </main>
  );
}