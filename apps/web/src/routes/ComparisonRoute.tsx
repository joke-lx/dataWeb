import type { JSX } from 'react';

import { ComparisonLaneGroup } from '../components/stage/ComparisonLaneGroup';
import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';
import { useComparison } from '../store/comparison';

export function ComparisonRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const enabled = useComparison((s) => s.enabled);
  const primarySample = useComparison((s) => s.primarySample);
  const secondarySample = useComparison((s) => s.secondarySample);

  // When comparison mode is enabled and a primary is set, reuse the existing
  // stacked layout (Hi-C matrix pair + mirrored tracks). Otherwise, fall back
  // to a single-sample stacked view so the route is never empty.
  if (enabled && primarySample) {
    return (
      <main className="route-page">
        <header className="route-header">
          <h2>Comparison</h2>
          <p>
            A: <code>{primarySample}</code> · B:{' '}
            <code>{secondarySample ?? '—'}</code>
          </p>
        </header>
        <div className="route-content">
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
        </div>
      </main>
    );
  }

  // Fallback: no comparison enabled — show single-sample stacked view.
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Comparison</h2>
        <p>
          Single-sample stacked view — enable comparison mode and pick a
          secondary sample in the LeftRail to overlay tracks.
        </p>
      </header>
      <div className="route-content">
        <Lane kind="hic" title="Hi-C matrix" sampleId={sampleId} />
        <Lane kind="bigwig" title="RNA-seq" trackName="rna_seq" sampleId={sampleId} />
        <Lane kind="bedGraph" title="AB index" trackName="ab" bedKind="ab" sampleId={sampleId} />
        <Lane kind="tadBar" title="TAD boundary" trackName="tad" bedKind="tad" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}