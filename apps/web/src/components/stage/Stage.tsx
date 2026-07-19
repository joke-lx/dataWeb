import { useRef } from 'react';
import type { JSX } from 'react';

import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useComparison } from '../../store/comparison';
import { useViewport } from '../../store/viewport';
import { CrosshairLayer } from '../overlay/CrosshairLayer';
import { ComparisonLaneGroup } from './ComparisonLaneGroup';
import { Lane } from './Lane';
import './stage.css';

export function Stage(): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  useD3Zoom(stageRef);
  const chr = useViewport((state) => state.chr);
  const start = useViewport((state) => state.start);
  const end = useViewport((state) => state.end);
  const bin = useViewport((state) => state.bin);

  const enabled = useComparison((s) => s.enabled);
  const primarySample = useComparison((s) => s.primarySample);
  const secondarySample = useComparison((s) => s.secondarySample);

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
        {enabled && primarySample ? (
          <>
            <ComparisonLaneGroup height={360} />
            <Lane
              kind="bedGraph"
              title="AB index (A)"
              trackName="ab"
              bedKind="ab"
              sampleId={primarySample}
            />
            {secondarySample && (
              <Lane
                kind="bedGraph"
                title="AB index (B)"
                trackName="ab"
                bedKind="ab"
                sampleId={secondarySample}
              />
            )}
            <Lane
              kind="bigwig"
              title="RNA-seq (A)"
              trackName="rna_seq"
              sampleId={primarySample}
              mirror={false}
            />
            {secondarySample && (
              <Lane
                kind="bigwig"
                title="RNA-seq (B)"
                trackName="rna_seq"
                sampleId={secondarySample}
                mirror
              />
            )}
            <Lane
              kind="tadBar"
              title="TAD (A)"
              trackName="tad"
              bedKind="tad"
              sampleId={primarySample}
            />
            {secondarySample && (
              <Lane
                kind="tadBar"
                title="TAD (B)"
                trackName="tad"
                bedKind="tad"
                sampleId={secondarySample}
              />
            )}
            <Lane
              kind="gene"
              title="Gene model"
              trackName="gene"
              bedKind="gene"
              sampleId={primarySample}
            />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}
