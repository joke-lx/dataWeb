import type { JSX } from 'react';

import { RegionInput } from '../nav/RegionInput';
import { ZoomSlider } from '../nav/ZoomSlider';
import { useComparison } from '../../store/comparison';

export function TopBar(): JSX.Element {
  const { enabled, toggle } = useComparison();

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
        <button
          type="button"
          className={
            'topbar__toggle' + (enabled ? ' topbar__toggle--active' : '')
          }
          onClick={toggle}
          aria-pressed={enabled}
        >
          对比模式
        </button>
      </div>
    </header>
  );
}