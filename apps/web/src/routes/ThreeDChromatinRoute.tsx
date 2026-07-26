import { JSX } from 'react';

import { ThreeDChromatin } from '../components/3d/ThreeDChromatin';
import { useActiveSample } from '../hooks/useActiveSample';

const TISSUE_LABEL: Record<'liver' | 'muscle' | 'brain', string> = {
  liver: 'Liver',
  muscle: 'Muscle',
  brain: 'Brain',
};

/**
 * 3D chromatin route — mirrors `docx/refrences/demo/chromatin3d.html`:
 * three independent rainbow-tube chromatin panels (Liver / Muscle / Brain)
 * stacked vertically, each 360×220 px with a right-side tissue label.
 * PEI enhancer / loop geometry is attached to the Brain panel using the
 * active sample's PEI records for the current viewport. Each panel owns
 * its own orbit state — drag/scroll events on one canvas never affect
 * the others.
 */
export function ThreeDChromatinRoute(): JSX.Element {
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  const organs: Array<'liver' | 'muscle' | 'brain'> = ['liver', 'muscle', 'brain'];

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>3D Chromatin Structure</h2>
        <p>
          Chromatin folding model · drag to orbit, scroll to zoom · sample{' '}
          <code>{activeSample}</code>
        </p>
      </header>
      <div className="route-content">
        <div className="three-d-grid">
          {organs.map((organ) => (
            <div key={organ} className="three-d-panel">
              <div className="three-d-panel__canvas">
                <ThreeDChromatin
                  organ={organ}
                  sampleId={organ === 'brain' ? activeSample : undefined}
                />
              </div>
              <span className="three-d-panel__label">
                {TISSUE_LABEL[organ]}
              </span>
            </div>
          ))}
          <div className="three-d-hint">
            drag to rotate · scroll to zoom · per-panel · auto-rotates when idle
          </div>
        </div>
      </div>
    </main>
  );
}