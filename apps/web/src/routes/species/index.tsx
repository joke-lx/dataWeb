import { useMemo, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import './species.css';

/**
 * Species landing page. Shows the species header + sample grid for the
 * species in the URL param. Reachable only from the home page species
 * cards — never a top-level nav target.
 */
export function SpeciesRoute(): JSX.Element {
  const { t } = useAppIntl();
  const { species: speciesId = 'pig' } = useParams<{ species: string }>();
  const { samples, isLoading, error } = useSampleCatalog();

  const grouped = useMemo<Array<[string, Sample[]]>>(() => {
    if (!samples) return [];
    const groups = new Map<string, Sample[]>();
    for (const s of samples) {
      if (s.species !== speciesId) continue;
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [samples, speciesId]);

  const speciesMeta: Record<string, { latin: string; title: string }> = {
    pig: { latin: 'Sus scrofa', title: t('home.species.pig.latinName') },
    chicken: { latin: 'Gallus gallus', title: t('home.species.chicken.latinName') },
  };
  const meta = speciesMeta[speciesId] ?? { latin: speciesId, title: speciesId };

  return (
    <RouteShell title={meta.title} subtitle={meta.latin}>
      {isLoading && <div className="samples-state">{t('common.loading')}</div>}
      {error instanceof Error && (
        <div className="samples-state samples-state--error">
          {t('species.error', { message: error.message })}
        </div>
      )}
      {!isLoading && !error && (
        <div className="samples-grid">
          {grouped.length === 0 ? (
            <div className="samples-state">{t('species.emptyForSpecies')}</div>
          ) : (
            grouped.map(([tissue, items]) => (
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
            ))
          )}
        </div>
      )}
    </RouteShell>
  );
}

export default SpeciesRoute;