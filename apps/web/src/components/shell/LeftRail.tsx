import type { JSX } from 'react';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSamples } from '../../api/client';
import type { Sample } from '../../api/types';
import { useSamples } from '../../store/samples';

function SampleItem({ sample }: { sample: Sample }): JSX.Element {
  const active = useSamples((s) => s.active);
  const setActive = useSamples((s) => s.setActive);

  const isActive = active === sample.id;

  return (
    <li>
      <button
        type="button"
        className={
          'sample-item' + (isActive ? ' sample-item--active' : '')
        }
        onClick={() => setActive(sample.id)}
      >
        <span className="sample-item__id">{sample.id}</span>
        <span className="sample-item__meta">
          {sample.tissue} · {sample.breed} · {sample.sex}
        </span>
      </button>
    </li>
  );
}

export function LeftRail(): JSX.Element {
  const setSamples = useSamples((s) => s.setSamples);

  const { data, isLoading, error } = useQuery({
    queryKey: ['samples', 'pig'],
    queryFn: () => fetchSamples('pig'),
  });

  // Sync fetched samples into the store so other components can read them.
  useEffect(() => {
    if (data) setSamples(data);
  }, [data, setSamples]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Sample[]>();
    (data ?? []).forEach((s) => {
      const arr = groups.get(s.tissue) ?? [];
      arr.push(s);
      groups.set(s.tissue, arr);
    });
    return Array.from(groups.entries());
  }, [data]);

  return (
    <aside className="left-rail">
      <div className="left-rail__title">
        样本 ({data ? data.length : 0})
      </div>

      {isLoading && (
        <div className="left-rail__state">加载中…</div>
      )}

      {error instanceof Error && (
        <div className="left-rail__state left-rail__state--error">
          加载失败: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="left-rail__groups">
          {grouped.map(([tissue, items]) => (
            <section key={tissue} className="left-rail__group">
              <h3 className="left-rail__group-title">{tissue}</h3>
              <ul className="left-rail__list">
                {items.map((s) => (
                  <SampleItem key={s.id} sample={s} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}