import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';

import { ROUTES } from '../../routes/registry';

export function TopBar(): JSX.Element {
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
    </header>
  );
}
