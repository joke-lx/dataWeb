import { useMemo } from 'react';
import type { JSX } from 'react';

import { ThreeDChromatin } from '../components/3d/ThreeDChromatin';
import { useActiveSample } from '../hooks/useActiveSample';
import { useSamples } from '../store/samples';

const PANEL_LIMIT = 3;

export function ThreeDChromatinRoute(): JSX.Element {
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  const allSamples = useSamples((s) => s.samples);

  // Show the active sample plus up to (PANEL_LIMIT - 1) others so the
  // viewer mirrors the side-by-side 3D panels in docx/refrences/demo7.png
  // (one panel per sample). Falls back to just the active sample when no
  // other samples are loaded.
  const sampleIds = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    if (activeSample) {
      ordered.push(activeSample);
      seen.add(activeSample);
    }
    for (const s of allSamples) {
      if (ordered.length >= PANEL_LIMIT) break;
      if (seen.has(s.id)) continue;
      ordered.push(s.id);
      seen.add(s.id);
    }
    return ordered;
  }, [activeSample, allSamples]);

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>3D Chromatin Structure</h2>
        <p>
          Chromatin folding model · drag to orbit, scroll to zoom ·{' '}
          {sampleIds.length === 1
            ? `sample ${sampleIds[0]}`
            : `${sampleIds.length} samples side-by-side`}
        </p>
      </header>
      <div className="route-content">
        <div className="three-d-grid">
          {sampleIds.map((id) => (
            <div key={id} className="three-d-cell">
              <h4 className="three-d-cell__title">{id}</h4>
              <ThreeDChromatin sampleId={id} height={320} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
