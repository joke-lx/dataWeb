import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { JSX } from 'react';

import type { Sample } from '../../../api/types';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { useSampleCatalog } from '../../../hooks/useSampleCatalog';
import { useTrackSampleSelection } from '../../../hooks/useTrackSampleSelection';
import { SUB_TABS, TRACK_CATALOG } from '../../../routes/trackSpec';
import type { TrackId } from '../../../routes/trackSpec';
import { BedGraphLane } from './BedGraphLane';
import { BigwigLane } from './BigwigLane';
import { BigwigStacked } from './BigwigStackedLane';
import { GeneLane } from './GeneLane';
import { InsulationLane } from './InsulationLane';
import { LoopTrack } from './LoopTrack';
import { PeiLane } from './PeiLane';
import { SvLane } from './SvLane';
import { TadBar } from './TadBar';
import { TrackSampleHeader } from './TrackSampleHeader';

export function TracksModel(): JSX.Element {
  const [params] = useSearchParams();
  const type = (params.get('type') ?? 'ab') as TrackId;
  const sampleId = useActiveSample() ?? 'Brain_BF3';

  const { sampleIds, setSampleIdsRaw } = useTrackSampleSelection();
  const { samples: allSamples } = useSampleCatalog();

  const tab = SUB_TABS.find((t) => t.id === type) ?? SUB_TABS[3];
  const mainSpec = TRACK_CATALOG[tab.id];

  const sampleById = useMemo(() => {
    const map = new Map<string, Sample>();
    (allSamples ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [allSamples]);

  const overlaySampleIds = mainSpec.kind === 'bigwig' ? sampleIds : undefined;
  const overlayMeta =
    overlaySampleIds === undefined
      ? undefined
      : overlaySampleIds.map(
          (id) =>
            sampleById.get(id) ??
            ({ id, species: '', tissue: '', breed: '', sex: '', individual: 0, dev_stage: '' } as Sample),
        );

  if (tab.id === 'loop') {
    return <LoopTrack />;
  }

  const renderMain = (): JSX.Element => {
    if (mainSpec.kind === 'bigwig') {
      return (
        <BigwigStacked
          sampleIds={overlaySampleIds ?? [sampleId]}
          sampleMeta={overlayMeta}
          trackName={mainSpec.trackName ?? 'rna_seq'}
          title={mainSpec.title}
          groupLabel={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'bedGraph') {
      return (
        <BedGraphLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'ab'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'is') {
      return (
        <InsulationLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'is'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'pei') {
      return (
        <PeiLane
          sampleId={sampleId}
          trackName={mainSpec.trackName ?? 'pei'}
          title={mainSpec.title}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'tadBar') {
      return (
        <TadBar
          sampleId={sampleId}
          height={mainSpec.defaultHeight}
        />
      );
    }
    if (mainSpec.kind === 'gene') {
      return (
        <GeneLane
          sampleId={sampleId}
          height={mainSpec.defaultHeight}
        />
      );
    }
    return (
      <BigwigLane
        sampleId={sampleId}
        trackName={mainSpec.trackName ?? 'rna_seq'}
        height={mainSpec.defaultHeight}
      />
    );
  };

  const renderAux = (auxId: TrackId): JSX.Element => {
    const aux = TRACK_CATALOG[auxId];
    if (aux.kind === 'bigwig') {
      return (
        <BigwigLane
          sampleId={sampleId}
          trackName={aux.trackName ?? 'rna_seq'}
          height={aux.defaultHeight}
        />
      );
    }
    if (aux.kind === 'bedGraph') {
      return (
        <BedGraphLane
          sampleId={sampleId}
          trackName={aux.trackName ?? 'ab'}
          title={aux.title}
          height={aux.defaultHeight}
        />
      );
    }
    if (aux.kind === 'is') {
      return (
        <InsulationLane
          sampleId={sampleId}
          trackName={aux.trackName ?? 'is'}
          title={aux.title}
          height={aux.defaultHeight}
        />
      );
    }
    if (aux.kind === 'pei') {
      return (
        <PeiLane
          sampleId={sampleId}
          trackName={aux.trackName ?? 'pei'}
          title={aux.title}
          height={aux.defaultHeight}
        />
      );
    }
    if (aux.kind === 'tadBar') {
      return <TadBar sampleId={sampleId} height={aux.defaultHeight} />;
    }
    if (aux.kind === 'gene') {
      return <GeneLane sampleId={sampleId} height={aux.defaultHeight} />;
    }
    if (aux.kind === 'sv') {
      return <SvLane sampleId={sampleId} title={aux.title} height={aux.defaultHeight} />;
    }
    return (
      <BigwigLane
        sampleId={sampleId}
        trackName={aux.trackName ?? 'rna_seq'}
        height={aux.defaultHeight}
      />
    );
  };

  return (
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
      {renderMain()}
      {tab.aux.map((auxId) => (
        <div key={auxId}>{renderAux(auxId)}</div>
      ))}
    </>
  );
}

export default TracksModel;