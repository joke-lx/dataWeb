import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { JSX } from 'react';

import { useActiveSample } from '../hooks/useActiveSample';
import { useSampleCatalog } from '../hooks/useSampleCatalog';
import { useTrackSampleSelection } from '../hooks/useTrackSampleSelection';
import { useViewport } from '../store/viewport';
import { Lane } from '../components/stage/Lane';
import { SubTabBar } from '../components/tracks/SubTabBar';
import { LoopTrack } from '../components/tracks/LoopTrack';
import { TrackSampleHeader } from '../components/tracks/TrackSampleHeader';
import { colorForTissue } from '../components/tracks/sampleColors';
import { SUB_TABS, TRACK_CATALOG } from './trackSpec';
import type { Sample } from '../api/types';
import type { TrackId } from './trackSpec';
import './route.css';

export function TracksRoute(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? 'ab') as TrackId;
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const viewport = useViewport();

  const { sampleIds, setSampleIdsRaw } = useTrackSampleSelection();
  const { samples: allSamples } = useSampleCatalog();

  // Find the matching sub-tab; fall back to structure→AB
  const tab = SUB_TABS.find((t) => t.id === type) ?? SUB_TABS[3];
  const mainSpec = TRACK_CATALOG[tab.id];

  // tab handler preserves `samples` and other params via callback form.
  const handleTabChange = (id: string): void => {
    setParams(
      (prev) => {
        prev.set('type', id);
        return prev;
      },
      { replace: false },
    );
  };

  // Build a sample-id → Sample lookup for color resolution. When the
  // catalog is still loading, raw IDs still flow through (resolved to
  // fallback gray) so the overlay renders without waiting for the catalog.
  const sampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (allSamples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [allSamples]);

  const overlaySampleIds = mainSpec.kind === 'bigwig' ? sampleIds : undefined;
  const overlayColors =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map((id) =>
          colorForTissue(sampleById.get(id)?.tissue),
        );

  return (
    <main className="route-page">
      <header className="route-header">
        <h2>Multi-omics Tracks</h2>
        <p>
          <code>{tab.id}</code> ·{' '}
          {overlaySampleIds ? (
            <>
              {overlaySampleIds.length} sample
              {overlaySampleIds.length === 1 ? '' : 's'} ·{' '}
            </>
          ) : (
            <>sample <code>{sampleId}</code> ·{' '}</>
          )}
          {viewport.chr}:{viewport.start.toLocaleString()}-
          {viewport.end.toLocaleString()}
        </p>
      </header>
      <SubTabBar tabs={SUB_TABS} value={tab.id} onChange={handleTabChange} />
      <div className="route-content">
        {tab.id === 'loop' ? (
          <LoopTrack />
        ) : (
          <>
            {overlaySampleIds && (
              <TrackSampleHeader
                title={mainSpec.title}
                sampleIds={overlaySampleIds}
                onSampleChange={setSampleIdsRaw}
                allSamples={allSamples ?? []}
                isCatalogLoading={allSamples === undefined}
              />
            )}
            <Lane
              kind={mainSpec.kind}
              title={mainSpec.title}
              trackName={mainSpec.trackName}
              bedKind={mainSpec.bedKind}
              sampleId={sampleId}
              sampleIds={overlaySampleIds}
              sampleColors={overlayColors}
              height={mainSpec.defaultHeight}
            />
            {tab.aux.map((auxId) => {
              const aux = TRACK_CATALOG[auxId];
              return (
                <Lane
                  key={auxId}
                  kind={aux.kind}
                  title={aux.title}
                  trackName={aux.trackName}
                  bedKind={aux.bedKind}
                  sampleId={sampleId}
                  height={aux.defaultHeight}
                />
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}