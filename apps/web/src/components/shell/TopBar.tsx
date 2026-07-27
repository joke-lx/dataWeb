import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';

import { useAppIntl } from '../../i18n';
import { I18nToggle } from '../../i18n/components/I18nToggle';
import { ROUTES } from '../../routes/registry';

export function TopBar(): JSX.Element {
  const { t } = useAppIntl();
  const mainRoutes = ROUTES.filter((r) => r.category === 'main');
  const triggerRoutes = ROUTES.filter((r) => r.category === 'trigger');

  return (
    <header className="topbar">
      <div className="topbar__brand">dataWeb</div>
      <nav className="topbar-nav topbar-nav--main" aria-label="Core models">
        {mainRoutes.map((r) => (
          <NavLink
            key={r.id}
            to={r.path}
            className={({ isActive }) =>
              'topbar-btn' + (isActive ? ' topbar-btn-active' : '')
            }
            title={r.description}
          >
            {t('nav.' + r.id, r.label)}
          </NavLink>
        ))}
      </nav>
      {triggerRoutes.length > 0 && (
        <nav className="topbar-nav topbar-nav--trigger" aria-label="Supplementary views">
          {triggerRoutes.map((r) => (
            <NavLink
              key={r.id}
              to={r.path}
              className={({ isActive }) =>
                'topbar-btn' + (isActive ? ' topbar-btn-active' : '')
              }
              title={r.description}
            >
              {t('nav.' + r.id, r.label)}
            </NavLink>
          ))}
        </nav>
      )}
      <I18nToggle />
    </header>
  );
}
