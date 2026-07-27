import { useEffect, useMemo, useState, type JSX } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ModelFactory } from '../../components/models';
import { RouteShell } from '../../components/route/RouteShell';
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
  const sample = useMemo(() => samples?.find((item) => item.id === id), [samples, id]);

  useEffect(() => { if (samples) setSamples(samples); }, [samples, setSamples]);
  useEffect(() => { if (sample) setActive(sample.id); }, [sample, setActive]);

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sample) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: id ?? '' })}</p></div></main>;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const subtitle = `${sample.species} · ${sample.tissue} · ${sample.breed} · ${sample.sex} · ${sample.dev_stage}`;
  return (
    <RouteShell
      title={`${sample.id} — ${sample.tissue} (${sample.species})`}
      subtitle={subtitle}
      breadcrumb={`${sample.species} › ${sample.tissue} › ${sample.id}`}
      actions={<div className="sample-actions">
        <div className="sample-picker"><button type="button" onClick={() => setShowSamples((open) => !open)}>{t('sample.actions.changeSample')} ▾</button>
          {showSamples && <div className="sample-picker__menu">{(samples ?? []).map((item) => <Link key={item.id} to={`/sample/${item.id}`} onClick={() => setShowSamples(false)}>{item.id}<small>{item.tissue} · {item.breed}</small></Link>)}</div>}</div>
        <button type="button" onClick={() => { const other = samples?.find((item) => item.id !== sample.id); if (other) navigate(`/compare/${sample.id}/${other.id}`); }}>{t('sample.actions.compareWith')}</button>
      </div>}
      toolbar={<div className="sample-tabs" role="tablist">{TABS.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{t(`sample.tabs.${item}`)}</button>)}</div>}
    >
      <div className="sample-region">{region} · {t('stage.binLabel', { bin: viewport.bin.toLocaleString() })}</div>
      <ModelFactory type={MODEL_TYPES[tab]} />
      <div className="sample-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}
