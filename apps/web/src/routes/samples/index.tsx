import { useMemo, type JSX } from 'react';
import { Link } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import './samples.css';

/**
 * Sample catalog selection page. Lists every available sample grouped by
 * tissue so the user picks one before entering its viewer. Reachable from
 * the home page species card "Browse →" CTA and from the TopBar.
 *
 * The page does NOT show any viewer — that only happens at /sample/:id.
 */
export function SamplesRoute(): JSX.Element {
  const { t } = useAppIntl();
  const { samples, isLoading, error } = useSampleCatalog();

  const grouped = useMemo<Array<[string, Sample[]]>>(() => {
    if (!samples) return [];
    const groups = new Map<string, Sample[]>();
    for (const s of samples) {
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [samples]);

  return (
    <RouteShell title={t('samples.title')} subtitle={t('samples.subtitle')}>
      {isLoading && <div className="samples-state">{t('common.loading')}</div>}
      {error instanceof Error && (
        <div className="samples-state samples-state--error">
          {t('samples.error', { message: error.message })}
        </div>
      )}
      {!isLoading && !error && (
        <div className="samples-grid">
          {grouped.map(([tissue, items]) => (
            <section key={tissue} className="samples-group">
              <h3 className="samples-group__title">{tissue}</h3>
              <div className="samples-group__items">
                {items.map((s) => (
                  <Link key={s.id} className="samples-card" to={`/sample/${s.id}`}>
                    <span className="samples-card__id">{s.id}</span>
                    <span className="samples-card__meta">
                      {s.breed} · {s.sex} · {s.dev_stage}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </RouteShell>
  );
}

export default SamplesRoute;