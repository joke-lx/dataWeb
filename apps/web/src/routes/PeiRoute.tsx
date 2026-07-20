import type { JSX } from 'react';

import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';

export function PeiRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Promoter-Enhancer Interactions</h2>
        <p>
          PEI anchors — sample <code>{sampleId}</code>
        </p>
      </header>
      <div className="route-content">
        <Lane kind="pei" title="PEI anchors" trackName="pei" bedKind="pei" sampleId={sampleId} />
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}