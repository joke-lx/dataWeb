import type { JSX } from 'react';

import { SecondarySamplePicker } from '../compare/SecondarySamplePicker';
import { RegionInput } from '../nav/RegionInput';
import { ZoomSlider } from '../nav/ZoomSlider';
import { useComparison } from '../../store/comparison';
import { useSamples } from '../../store/samples';

export function TopBar(): JSX.Element {
  const enabled = useComparison((s) => s.enabled);

  // Before enabling comparison, capture the currently-active sample as the
  // primary (sample A). Don't overwrite a primary the user already chose on a
  // later toggle-off / toggle-on cycle.
  const toggleCompare = (): void => {
    const comparison = useComparison.getState();
    if (!comparison.enabled) {
      const active = useSamples.getState().active;
      if (active && !comparison.primarySample) {
        useComparison.setState({ primarySample: active });
      }
    }
    comparison.toggle();
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">dataWeb</div>

      <div className="topbar__center">
        <label className="topbar__species">
          <span className="topbar__species-label">Species</span>
          <select className="topbar__species-select" defaultValue="pig">
            <option value="pig">Pig</option>
          </select>
        </label>
        <RegionInput />
        <ZoomSlider />
      </div>

      <div className="topbar__right">
        <SecondarySamplePicker />
        <button
          type="button"
          className={
            'topbar__toggle' + (enabled ? ' topbar__toggle--active' : '')
          }
          onClick={toggleCompare}
          aria-pressed={enabled}
        >
          对比模式
        </button>
      </div>
    </header>
  );
}
