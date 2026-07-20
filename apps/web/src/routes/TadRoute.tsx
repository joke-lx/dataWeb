import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function TadRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>TAD Domains</h2>
        <p>
          Topologically associating domains — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="tadBar" title="TAD domains" trackName="tad" bedKind="tad" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}