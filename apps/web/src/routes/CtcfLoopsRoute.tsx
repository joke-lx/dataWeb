import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { CTCFLoops } from '../components/overlay/CTCFLoops';
import { Lane } from '../components/stage/Lane';
import { useActiveSample } from '../hooks/useActiveSample';
import { useViewport } from '../store/viewport';

export function CtcfLoopsRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const viewport = useViewport();
  const [overlayWidth, setOverlayWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerWidth - 240,
  );

  useEffect(() => {
    const onResize = () => setOverlayWidth(Math.max(320, window.innerWidth - 240));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>CTCF Loops</h2>
        <p>
          Sample <code>{sampleId}</code> · {viewport.chr}:
          {viewport.start.toLocaleString()}-{viewport.end.toLocaleString()}
        </p>
      </header>
      <div className="route-content">
        <Lane
          kind="hic"
          title="Hi-C matrix"
          trackName="hic"
          sampleId={sampleId}
          height={320}
        />
        <div className="ctcf-overlay-row" style={{ width: '100%', height: 60 }}>
          <CTCFLoops sampleId={sampleId} height={60} width={overlayWidth} />
        </div>
        <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
      </div>
    </main>
  );
}