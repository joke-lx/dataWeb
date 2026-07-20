import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';

import { SecondarySamplePicker } from '../compare/SecondarySamplePicker';
import { RegionInput } from '../nav/RegionInput';
import { ZoomSlider } from '../nav/ZoomSlider';
import { ROUTES } from '../../routes/registry';
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

      <nav className="topbar-nav" aria-label="Model routes">
        {ROUTES.map((r) => (
          <NavLink
            key={r.id}
            to={r.path}
            className={({ isActive }) =>
              'topbar-btn' + (isActive ? ' topbar-btn-active' : '')
            }
            title={r.description}
          >
            {r.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar__right">
        <RegionInput />
        <ZoomSlider />
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