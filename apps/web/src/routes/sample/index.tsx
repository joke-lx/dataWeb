import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ModelFactory } from '../../components/models';
import { RouteShell } from '../../components/route/RouteShell';
import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import './sample.css';

const TABS = ['hic', 'tracks', '3d', 'ctcfMotif'] as const;
type SampleTab = (typeof TABS)[number];
const MODEL_TYPES: Record<SampleTab, 'hic' | 'tracks' | '3d' | 'ctcf-motif'> = {
  hic: 'hic', tracks: 'tracks', '3d': '3d', ctcfMotif: 'ctcf-motif',
};

export function SampleRoute(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const setActive = useSamples((state) => state.setActive);
  const setSamples = useSamples((state) => state.setSamples);
  const viewport = useViewport();
  const [tab, setTab] = useState<SampleTab>((params.get('tab') as SampleTab) || 'hic');
  const [showSamples, setShowSamples] = useState(false);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const viewerRef = useRef<HTMLDivElement>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const comparePopoverRef = useRef<HTMLDivElement>(null);
  useD3Zoom(viewerRef);
  const sample = useMemo(() => samples?.find((item) => item.id === id), [samples, id]);

  useEffect(() => { if (samples) setSamples(samples); }, [samples, setSamples]);
  useEffect(() => { if (sample) setActive(sample.id); }, [sample, setActive]);

  useEffect(() => {
    if (!showComparePicker) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        comparePopoverRef.current && !comparePopoverRef.current.contains(target) &&
        compareButtonRef.current && !compareButtonRef.current.contains(target)
      ) {
        setShowComparePicker(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowComparePicker(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showComparePicker]);

  const candidates = useMemo(
    () => (samples ?? []).filter((item) => item.id !== sample?.id),
    [samples, sample?.id],
  );
  const suggested = useMemo(
    () =>
      !sample
        ? []
        : candidates.filter(
            (item) => item.breed === sample.breed && item.tissue !== sample.tissue,
          ),
    [candidates, sample],
  );
  const query = searchQuery.trim().toLowerCase();
  const filteredSuggested = useMemo(
    () =>
      suggested.filter(
        (item) =>
          !query ||
          item.id.toLowerCase().includes(query) ||
          item.tissue.toLowerCase().includes(query),
      ),
    [suggested, query],
  );
  const allSamples = useMemo(
    () =>
      candidates
        .filter(
          (item) =>
            !query ||
            item.id.toLowerCase().includes(query) ||
            item.tissue.toLowerCase().includes(query),
        )
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    [candidates, query],
  );
  const canCompare = candidates.length > 0;

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const subtitle = `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;

  const navigateToCompare = (targetId: string) => {
    setShowComparePicker(false);
    navigate(`/compare/${sample.id}/${targetId}`);
  };

  return (
    <RouteShell
      title={`${sample.id} — ${sample.tissue} (${sample.species})`}
      subtitle={subtitle}
      breadcrumb={`${sample.species} › ${sample.tissue} › ${sample.id}`}
      actions={null}
      toolbar={
        <div className="sample-toolbar">
          <div className="sample-picker"><button type="button" onClick={() => setShowSamples((open) => !open)}>{t('sample.actions.changeSample')} ▾</button>
            {showSamples && <div className="sample-picker__menu">{(samples ?? []).map((item) => <Link key={item.id} to={`/sample/${item.id}`} onClick={() => setShowSamples(false)}>{item.id}<small>{item.tissue} · {item.breed}</small></Link>)}</div>}
          </div>
          <div className="sample-tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={tab === item ? 'active' : ''}
                onClick={() => setTab(item)}
              >
                {t(`sample.tabs.${item}`)}
              </button>
            ))}
          </div>
          {canCompare && <div className="sample-picker">
            <button
              type="button"
              ref={compareButtonRef}
              aria-haspopup="dialog"
              aria-expanded={showComparePicker}
              disabled={!canCompare}
              onClick={() => setShowComparePicker((open) => !open)}
            >
              {t('sample.actions.compareWith')} ▾
            </button>
            {showComparePicker && <div className="compare-picker" ref={comparePopoverRef} role="dialog" aria-label={t('sample.comparePicker.title')}>
              {!canCompare ? (
                <div className="compare-picker__empty">{t('sample.comparePicker.empty')}</div>
              ) : (
                <>
                  <div className="compare-picker__head">
                    <div className="compare-picker__title">{t('sample.comparePicker.title')} <em>{sample.id}</em></div>
                    <button type="button" className="compare-picker__dismiss" aria-label="close" onClick={() => setShowComparePicker(false)}>▴</button>
                  </div>
                  <div className="compare-picker__body">
                    <div className="compare-picker__search">
                      <svg className="compare-picker__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('sample.comparePicker.search')} autoFocus />
                    </div>
                    <h4 className="compare-picker__section"><span className="compare-picker__meta-dot" aria-hidden="true" />{t('sample.comparePicker.suggested')}</h4>
                    {filteredSuggested.length === 0 ? <div className="compare-picker__empty-section">—</div> : filteredSuggested.map((other) => (
                      <button key={other.id} type="button" className="compare-picker__chip" onClick={() => navigateToCompare(other.id)}>
                        <span className="compare-picker__chip-id">{other.id}</span>
                        <span className="compare-picker__chip-tag">{t('sample.comparePicker.sameBreed')}</span>
                        <span className="compare-picker__chip-arrow" aria-hidden="true">→</span>
                      </button>
                    ))}
                    <h4 className="compare-picker__section">{t('sample.comparePicker.allSamples', { count: allSamples.length })}</h4>
                    <div className="compare-picker__list">
                      {allSamples.map((other) => (
                        <div key={other.id} role="button" tabIndex={0} className="compare-picker__row" onClick={() => navigateToCompare(other.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateToCompare(other.id); } }}>
                          <span className="compare-picker__row-id">{other.id}</span>
                          <span className="compare-picker__row-meta">{other.tissue} · {other.breed} · {other.sex}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="compare-picker__foot">{t('sample.comparePicker.helper')}</div>
                </>
              )}
            </div>}
          </div>}
        </div>
      }
    >
      <div className="sample-region">{region} · {t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</div>
      <div ref={viewerRef} className="sample-viewer">
        <ModelFactory type={MODEL_TYPES[tab]} />
      </div>
      <div className="sample-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}
