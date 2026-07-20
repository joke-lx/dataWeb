import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';
import { useViewport } from '../store/viewport';

export function HicRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const viewport = useViewport();
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Hi-C Contact Matrix</h2>
        <p>
          Sample <code>{sampleId}</code> ·{' '}
          {viewport.chr}:{viewport.start.toLocaleString()}-
          {viewport.end.toLocaleString()}
        </p>
      </header>
      <div className="route-content">
        <Lane kind="hic" title="Hi-C matrix" trackName="hic" sampleId={sampleId} />
        <Lane kind="tadBar" title="TAD boundary" trackName="tad" bedKind="tad" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}