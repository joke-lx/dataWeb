import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function RnaSeqRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>RNA-seq</h2>
        <p>
          Gene expression bigwig — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="bigwig" title="RNA-seq" trackName="rna_seq" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}