import { useEffect, useMemo, useState, type JSX } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ModelFactory } from '../../components/models';
import { RouteShell } from '../../components/route/RouteShell';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useAppIntl } from '../../i18n';
import { useSamples } from '../../store/samples';
import { useViewport } from '../../store/viewport';
import './compare.css';

const COMPARISON_MODES = ['tissue', 'breed', 'cross', 'developmental'] as const;
type CompareMode = (typeof COMPARISON_MODES)[number];

const MODE_VIEWERS: Record<CompareMode, 'differential' | 'hic' | 'tracks'> = {
  tissue: 'differential',
  breed: 'hic',
  cross: 'hic',
  developmental: 'hic',
};

export function CompareRoute(): JSX.Element {
  const { a, b } = useParams<{ a: string; b: string }>();
  const navigate = useNavigate();
  const { t } = useAppIntl();
  const { samples, isLoading } = useSampleCatalog();
  const setSamples = useSamples((state) => state.setSamples);
  const setActive = useSamples((state) => state.setActive);
  const viewport = useViewport();
  const [mode, setMode] = useState<CompareMode>('tissue');

  const sampleA = useMemo(() => samples?.find((item) => item.id === a), [samples, a]);
  const sampleB = useMemo(() => samples?.find((item) => item.id === b), [samples, b]);

  useEffect(() => { if (samples) setSamples(samples); }, [samples, setSamples]);
  useEffect(() => { if (a) setActive(a); }, [a, setActive]);

  if (isLoading) return <main className="route-page"><div className="route-content">{t('common.loading')}</div></main>;
  if (!sampleA || !sampleB) return <main className="route-page"><div className="model-missing"><strong>{t('sample.notFound.title')}</strong><p>{t('sample.notFound.description', { id: sampleA ? (b ?? '') : (a ?? '') })}</p></div></main>;

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  const tissueLabel = t(`home.comparison.${mode}.title`);
  const activeViewer = MODE_VIEWERS[mode];

  return (
    <RouteShell
      title={t('compare.title', { a: sampleA.id, b: sampleB.id })}
      subtitle={`${sampleA.tissue} vs ${sampleB.tissue} · ${sampleA.species} · ${sampleA.breed} vs ${sampleB.breed} · ${region}`}
      actions={<div className="compare-actions">
        <button type="button" onClick={() => setMode((prev) => prev === 'developmental' ? 'tissue' : COMPARISON_MODES[COMPARISON_MODES.indexOf(prev) + 1])}>{t('compare.actions.switchAB')}</button>
        <button type="button" onClick={() => navigate('/')}>{t('compare.actions.changeSamples')}</button>
      </div>}
      toolbar={<div className="compare-modes" role="tablist">{COMPARISON_MODES.map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{t(`compare.mode.${item}`)}</button>)}</div>}
    >
      <ModelFactory type={activeViewer} />
      {activeViewer === 'differential' && <div className="compare-note">{t('compare.viewer.differentialNote', { a: sampleA.id, b: sampleB.id })}</div>}
      {activeViewer !== 'differential' && <div className="compare-note">{t('compare.viewer.comingSoon', { mode: tissueLabel })}</div>}
      <div className="compare-navigator">{t('sample.regionNavigator')}</div>
    </RouteShell>
  );
}
