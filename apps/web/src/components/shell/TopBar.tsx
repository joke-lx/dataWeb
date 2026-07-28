import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { useAppIntl } from '../../i18n';
import { I18nToggle } from '../../i18n/components/I18nToggle';

export function TopBar(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">dataWeb</Link>
      <nav className="topbar-nav topbar-nav--main" aria-label={t('nav.home')}>
        <Link to="/" className="topbar-btn">{t('nav.home')}</Link>
        <Link to="/samples" className="topbar-btn">{t('nav.samples')}</Link>
      </nav>
      <I18nToggle />
    </header>
  );
}
