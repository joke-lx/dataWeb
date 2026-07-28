import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ModelFactory } from '../../components/models';
import { RouteShell } from '../../components/route/RouteShell';
import { useD3Zoom } from '../../hooks/useD3Zoom';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import type { Sample } from '../../api/types';
import './sample.css';

const TABS = ['hic', 'tracks', '3d', 'ctcfMotif'] as const;
type SampleTab = (typeof TABS)[number];
const MODEL_TYPES: Record<SampleTab, 'hic' | 'tracks' | '3d' | 'ctcf-motif'> = {
  hic: 'hic', tracks: 'tracks', '3d': '3d', ctcfMotif: 'ctcf-motif',
};

type CompareGroup = 'sameBreedDifferentTissue' | 'sameTissueDifferentBreed' | 'sameSpeciesDifferentBreedAndTissue' | 'differentSpecies';

function classifyCompareGroup(current: Sample, other: Sample): CompareGroup {
  if (other.species !== current.species) return 'differentSpecies';
  if (other.breed === current.breed && other.tissue !== current.tissue) return 'sameBreedDifferentTissue';
  if (other.tissue === current.tissue && other.breed !== current.breed) return 'sameTissueDifferentBreed';
  return 'sameSpeciesDifferentBreedAndTissue';
}

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

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const subtitle = `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;

  const otherSamples = (samples ?? []).filter((item) => item.id !== sample.id);
  const grouped: Record<CompareGroup, Sample[]> = {
    sameBreedDifferentTissue: [],
    sameTissueDifferentBreed: [],
    sameSpeciesDifferentBreedAndTissue: [],
    differentSpecies: [],
  };
  for (const other of otherSamples) {
    grouped[classifyCompareGroup(sample, other)].push(other);
  }
  const groupOrder: CompareGroup[] = [
    'sameBreedDifferentTissue',
    'sameTissueDifferentBreed',
    'sameSpeciesDifferentBreedAndTissue',
    'differentSpecies',
  ];
  const groupLabels: Record<CompareGroup, string> = {
    sameBreedDifferentTissue: t('sample.comparePicker.sameBreedDifferentTissue'),
    sameTissueDifferentBreed: t('sample.comparePicker.sameTissueDifferentBreed'),
    sameSpeciesDifferentBreedAndTissue: t('sample.comparePicker.sameSpeciesDifferentBreedAndTissue'),
    differentSpecies: t('sample.comparePicker.differentSpecies'),
  };
  const canCompare = otherSamples.length > 0;

  return (
    <RouteShell
      title={`${sample.id} — ${sample.tissue} (${sample.species})`}
      subtitle={subtitle}
      breadcrumb={`${sample.species} › ${sample.tissue} › ${sample.id}`}
      actions={<div className="sample-actions">
        <div className="sample-picker"><button type="button" onClick={() => setShowSamples((open) => !open)}>{t('sample.actions.changeSample')} ▾</button>
          {showSamples && <div className="sample-picker__menu">{(samples ?? []).map((item) => <Link key={item.id} to={`/sample/${item.id}`} onClick={() => setShowSamples(false)}>{item.id}<small>{item.tissue} · {item.breed}</small></Link>)}</div>}</div>
        <div className="sample-picker">
          <button
            type="button"
            ref={compareButtonRef}
            aria-haspopup="listbox"
            aria-expanded={showComparePicker}
            disabled={!canCompare}
            onClick={() => setShowComparePicker((open) => !open)}
          >
            {t('sample.actions.compareWith')} ▾
          </button>
          {showComparePicker && (
            <div className="sample-picker__menu compare-picker" ref={comparePopoverRef} role="listbox">
              {!canCompare ? (
                <div className="compare-picker__empty">{t('sample.comparePicker.empty')}</div>
              ) : (
                <>
                  <div className="compare-picker__heading">{t('sample.comparePicker.heading', { id: sample.id })}</div>
                  {groupOrder.map((groupKey) => {
                    const items = grouped[groupKey];
                    if (items.length === 0) return null;
                    const isRecommended = groupKey === 'sameBreedDifferentTissue' || groupKey === 'sameTissueDifferentBreed';
                    return (
                      <div key={groupKey} className="compare-picker__group">
                        <div className="compare-picker__group-header">
                          <span>{groupLabels[groupKey]}</span>
                          {isRecommended && <span className="compare-picker__badge">{t('sample.comparePicker.recommended')}</span>}
                        </div>
                        {items.map((other) => (
                          <button
                            key={other.id}
                            type="button"
                            role="option"
                            aria-selected="false"
                            className="compare-picker__option"
                            onClick={() => { setShowComparePicker(false); navigate(`/compare/${sample.id}/${other.id}`); }}
                          >
                            <span className="compare-picker__option-id">{other.id}</span>
                            <span className="compare-picker__option-meta">
                              <span className="compare-picker__chip">{other.tissue}</span>
                              <span className="compare-picker__chip">{other.breed}</span>
                              <span className="compare-picker__chip">{other.sex}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>}
      toolbar={<div className="sample-tabs" role="tablist">{TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`sample.tabs.${item}`)}</button>)}</div>}
    >
      <div className="sample-region">{region} · {t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</div>
      <div ref={viewerRef} className="sample-viewer">
        <ModelFactory type={MODEL_TYPES[tab]} />
      </div>
      <div className="sample-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}
