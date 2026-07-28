import type { JSX, ReactNode } from 'react';

import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';
import './route.css';

interface RouteShellProps {
  /** Main page title (h2). */
  title: string;
  /** Optional subtitle/description below the title. */
  subtitle?: string;
  /** Optional actions shown on the right of the page header. */
  actions?: ReactNode;
  /** Optional toolbar (controls row below page header). */
  toolbar?: ReactNode;
  /** Region breadcrumb override (defaults from viewport). */
  breadcrumb?: string;
  children: ReactNode;
}

/**
 * RouteShell — shared layout template for all viewer routes.
 *
 * Provides the standard `.route-page` > `.route-header` + `.route-content`
 * frame with consistent padding, typography, and responsive behavior.
 *
 * Usage:
 * ```tsx
 * <RouteShell title={t('hic.viewer.title')} subtitle={desc} actions={<ShareBtn />}>
 *   <HicModel />
 * </RouteShell>
 * ```
 */
export function RouteShell({
  title,
  subtitle,
  actions,
  toolbar,
  breadcrumb,
  children,
}: RouteShellProps): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();

  const region =
    breadcrumb ??
    `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;

  return (
    <main className="route-page">
      <header className="route-header">
        <div className="route-header__row">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="route-header__subtitle">{subtitle}</p>}
          </div>
          {actions && (
            <div className="route-header__actions">{actions}</div>
          )}
        </div>
        <div className="route-header__region">
          <span className="route-header__region-text">{region}</span>
          <span className="route-header__bin">{t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</span>
        </div>
      </header>
      {toolbar && <div className="route-toolbar">{toolbar}</div>}
      <div className="route-content">{children}</div>
    </main>
  );
}
