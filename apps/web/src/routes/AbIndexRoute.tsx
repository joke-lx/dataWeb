import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function AbIndexRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>AB Index</h2>
        <p>
          A/B compartment bar — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="bedGraph" title="AB index" trackName="ab" bedKind="ab" sampleId={sampleId} />
        <Lane kind="tadBar" title="TAD boundary" trackName="tad" bedKind="tad" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}