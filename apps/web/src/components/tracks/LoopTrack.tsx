import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { useActiveSample } from '../../hooks/useActiveSample';
import { Lane } from '../stage/Lane';
import { CTCFLoops } from '../overlay/CTCFLoops';
import './tracks.css';

/** Special layout for the "loops" sub-tab: Hi-C(320) + SVG overlay(60) + gene. */
export function LoopTrack(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const [overlayWidth, setOverlayWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerWidth - 240,
  );

  useEffect(() => {
    const onResize = () => setOverlayWidth(Math.max(320, window.innerWidth - 240));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="loop-track">
      <Lane kind="hic" title="Hi-C matrix" trackName="hic" sampleId={sampleId} height={320} />
      <div className="loop-track__overlay" style={{ width: '100%', height: 60 }}>
        <CTCFLoops sampleId={sampleId} height={60} width={overlayWidth} />
      </div>
      <Lane kind="gene" title="Gene model" trackName="gene" bedKind="gene" sampleId={sampleId} />
    </div>
  );
}
