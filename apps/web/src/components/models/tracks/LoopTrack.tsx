import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { CTCFLoops } from '../../../components/overlay/CTCFLoops';
import { GeneLane } from './GeneLane';
import { HiCMatrix } from './HiCMatrix';
import './tracks.css';

const LOOP_HIC_HEIGHT = 320;

interface LoopTrackProps {
  sampleId: string;
}

/** Special layout for the "loops" sub-tab: Hi-C(320) + SVG overlay(60) + gene. */
export function LoopTrack({ sampleId }: LoopTrackProps): JSX.Element {
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
      <HiCMatrix sampleId={sampleId} height={LOOP_HIC_HEIGHT} />
      <div className="loop-track__overlay" style={{ width: '100%', height: 60 }}>
        <CTCFLoops sampleId={sampleId} height={60} width={overlayWidth} />
      </div>
      <GeneLane sampleId={sampleId} />
    </div>
  );
}