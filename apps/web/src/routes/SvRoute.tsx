import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function SvRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Structural Variants</h2>
        <p>
          DEL / DUP / INV / TRA markers — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="sv" title="Structural variants" trackName="sv" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}