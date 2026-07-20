import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function H3K27acRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>H3K27ac</h2>
        <p>
          Active enhancer ChIP-seq — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="bigwig" title="H3K27ac" trackName="h3k27ac" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}