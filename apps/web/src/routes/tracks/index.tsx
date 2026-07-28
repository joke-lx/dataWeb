import { useMemo, type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { Sample } from '../../api/types';
import { RouteShell } from '../../components/route/RouteShell';
import { TracksModel } from '../../components/models/tracks';
import { TrackSampleHeader } from '../../components/models/tracks/TrackSampleHeader';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { useTrackSampleSelection } from '../../hooks/useTrackSampleSelection';
import { useAppIntl } from '../../i18n';
import { useViewport } from '../../store/viewport';
import { SUB_TABS, TRACK_CATALOG } from '../trackSpec';
import type { TrackId } from '../trackSpec';
import { SubTabBar } from '../../components/models/tracks/SubTabBar';

export function TracksRoute(): JSX.Element {
  const { t } = useAppIntl();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') ?? 'ab') as TrackId;
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const viewport = useViewport();
  const { samples } = useSampleCatalog();
  const { sampleIds, setSampleIdsRaw } = useTrackSampleSelection();

  const tab = SUB_TABS.find((t) => t.id === type) ?? SUB_TABS[3];
  const mainSpec = TRACK_CATALOG[tab.id];

  const sampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (samples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [samples]);

  const overlaySampleIds = mainSpec.kind === 'bigwig' ? sampleIds : undefined;
  const overlayMeta =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map(
          (id) =>
            sampleById.get(id) ??
            ({ id, species: '', tissue: '', breed: '', sex: '', individual: 0, dev_stage: '' } as Sample),
        );

  const handleTabChange = (id: string): void => {
    setParams((prev) => { prev.set('type', id); return prev; }, { replace: false });
  };

  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
  return (
    <RouteShell title={t('tracks.subtab.' + tab.id, tab.label)} subtitle={`${tab.id} · ${region} · sample ${sampleId}`}>
      <SubTabBar tabs={SUB_TABS} value={tab.id} onChange={handleTabChange} />
      {overlaySampleIds && (
        <TrackSampleHeader
          title={TRACK_CATALOG[tab.id].title}
          sampleIds={overlaySampleIds}
          onSampleChange={setSampleIdsRaw}
          allSamples={samples ?? []}
          isCatalogLoading={samples === undefined}
        />
      )}
      <TracksModel
        tab={tab.id}
        sampleId={sampleId}
        aux={tab.aux}
        overlaySampleIds={overlaySampleIds}
        overlayMeta={overlayMeta}
      />
    </RouteShell>
  );
}
