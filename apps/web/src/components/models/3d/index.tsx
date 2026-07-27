import { JSX } from 'react';

import { useAppIntl } from '../../../i18n';
import { ThreeDChromatin } from './ThreeDChromatin';
import { useActiveSample } from '../../../hooks/useActiveSample';

/**
 * 3D chromatin model — three independent rainbow-tube chromatin panels
 * (Liver / Muscle / Brain) stacked vertically, each 360×220 px with a
 * right-side tissue label. PEI enhancer / loop geometry is attached to the
 * Brain panel using the active sample's PEI records for the current viewport.
 * Each panel owns its own orbit state — drag/scroll events on one canvas
 * never affect the others.
 */
export function ThreeDModel(): JSX.Element {
  const { t } = useAppIntl();
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  const organs: Array<'liver' | 'muscle' | 'brain'> = ['liver', 'muscle', 'brain'];

  return (
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
            {t('3d.tissue.' + organ)}
          </span>
        </div>
      ))}
      <div className="three-d-hint">
        {t('3d.viewer.hint')}
      </div>
    </div>
  );
}

export default ThreeDModel;
