import type { JSX } from 'react';

import { ThreeDChromatin } from '../components/3d/ThreeDChromatin';
import { useActiveSample } from '../hooks/useActiveSample';

export function ThreeDChromatinRoute(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <main className="route-page">
      <header className="route-header">
        <h2>3D Chromatin Structure</h2>
        <p>
          Sample <code>{sampleId}</code> · drag to orbit, scroll to zoom
        </p>
      </header>
      <div className="route-content">
        <ThreeDChromatin height={500} />
      </div>
    </main>
  );
}