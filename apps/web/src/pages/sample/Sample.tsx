import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { ModelFactory } from '../../components/models';
import type { ModelType } from '../../components/models';
import { RouteShell } from '../../components/route/RouteShell';
import { TracksModel } from '../../components/models/tracks';
import { TrackSampleHeader } from '../../components/models/tracks/TrackSampleHeader';
import { GeneLane } from '../../components/models/differential/GeneLane';
import { Log2Heatmap } from '../../components/models/differential/Log2Heatmap';
import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useTrackSampleSelection } from '../../hooks/useTrackSampleSelection';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import { SUB_TABS, TRACK_CATALOG } from '../../components/models/tracks/trackSpec';
import type { TrackId } from '../../components/models/tracks/trackSpec';
import './sample.css';

const TABS = ['hic', 'tracks', '3d', 'ctcfMotif'] as const;
type SampleTab = (typeof TABS)[number];
const MODEL_TYPES: Record<SampleTab, string> = {
  hic: 'hic', tracks: 'tracks', '3d': '3d', ctcfMotif: 'ctcf-motif',
};

export function Sample(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const setActive = useSamples((state) => state.setActive);
  const setSamples = useSamples((state) => state.setSamples);
  const viewport = useViewport();
  const partnerId = params.get('vs');
  const [tab, setTab] = useState<SampleTab>((params.get('tab') as SampleTab) || 'hic');
  const [showSamples, setShowSamples] = useState(false);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const viewerRef = useRef<HTMLDivElement>(null);
  const compareButtonRef = useRef<HTMLButtonElement>(null);
  const comparePopoverRef = useRef<HTMLDivElement>(null);
  useD3Zoom(viewerRef);
  const sample = useMemo(() => samples?.find((item) => item.id === id), [samples, id]);
  const partner = useMemo(
    () => (partnerId ? samples?.find((item) => item.id === partnerId) : undefined),
    [samples, partnerId],
  );
  const isCompareMode = Boolean(partnerId && partner && sample && partnerId !== sample.id);

  // --- Tracks sub-tab business logic ---
  const trackType = (params.get('type') ?? 'ab') as TrackId;
  const trackSubTab = SUB_TABS.find((t) => t.id === trackType) ?? SUB_TABS[3];
  const trackAux = trackSubTab.aux;
  const { sampleIds: trackSampleIds, setSampleIdsRaw } = useTrackSampleSelection();
  const trackMainSpec = TRACK_CATALOG[trackSubTab.id];
  const trackSampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (samples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [samples]);
  const overlaySampleIds = trackMainSpec.kind === 'bigwig' ? trackSampleIds : undefined;
  const overlayMeta =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map(
          (id) =>
            trackSampleById.get(id) ??
            ({ id, species: '', tissue: '', breed: '', sex: '', individual: 0, dev_stage: '' } as Sample),
        );
  // --- end tracks business logic ---

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

  // Compare mode requires both samples to exist; treat as off if partner is missing.
  const compareActive = isCompareMode && partner;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const subtitle = compareActive && partner
    ? `${sample.tissue} vs ${partner.tissue} · ${sample.species} · ${sample.breed} vs ${partner.breed} · ${region}`
    : `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;

  const navigateToCompare = (targetId: string) => {
    setShowComparePicker(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('vs', targetId);
        return next;
      },
      { replace: false },
    );
  };

  const exitCompare = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('vs');
        return next;
      },
      { replace: false },
    );
  };

  const title = compareActive && partner
    ? `${sample.id} vs ${partner.id}`
    : `${sample.id} — ${sample.tissue} (${sample.species})`;

  return (
    <RouteShell
      title={title}
      subtitle={subtitle}
      breadcrumb={
        compareActive && partner
          ? `${sample.species} › ${sample.tissue} › ${sample.id} vs ${partner.id}`
          : `${sample.species} › ${sample.tissue} › ${sample.id}`
      }
      actions={
        compareActive && partner ? (
          <div className="sample-actions">
            <button type="button" onClick={exitCompare} aria-label={t('sample.compare.closeButton')}>
              {t('sample.compare.closeButton')} ×
            </button>
          </div>
        ) : null
      }
      toolbar={
        <div className="sample-toolbar">
          <div className="sample-picker"><button type="button" onClick={() => setShowSamples((open) => !open)}>{t('sample.actions.changeSample')} ▾</button>
            {showSamples && <div className="sample-picker__menu">{(samples ?? []).map((item) => <Link key={item.id} to={`/sample/${item.id}`} onClick={() => setShowSamples(false)}>{item.id}<small>{item.tissue} · {item.breed}</small></Link>)}</div>}
          </div>
          {!compareActive && (
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
          )}
          {compareActive && (
            <div className="sample-tabs sample-tabs--compare" role="tablist">
              <button type="button" role="tab" aria-selected={true} className="active">
                {sample.id}
              </button>
              <button type="button" role="tab" aria-selected={true} className="active">
                vs {partner.id}
              </button>
            </div>
          )}
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
        {compareActive && partner ? (
          <>
            <Log2Heatmap sampleA={sample.id} sampleB={partner.id} />
            <GeneLane sampleId={sample.id} />
          </>
        ) : tab === 'tracks' ? (
          <>
            {overlaySampleIds && (
              <TrackSampleHeader
                title={TRACK_CATALOG[trackSubTab.id].title}
                sampleIds={overlaySampleIds}
                onSampleChange={setSampleIdsRaw}
                allSamples={samples ?? []}
                isCatalogLoading={isLoading}
              />
            )}
            <TracksModel
              tab={trackSubTab.id}
              sampleId={sample.id}
              aux={trackAux}
              overlaySampleIds={overlaySampleIds}
              overlayMeta={overlayMeta}
            />
          </>
        ) : (
          <ModelFactory type={MODEL_TYPES[tab] as ModelType} />
        )}
      </div>
      <div className="sample-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}

export default Sample;