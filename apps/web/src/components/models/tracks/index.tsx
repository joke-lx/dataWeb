import type { JSX } from 'react';

import type { Sample } from '../../../api/types';
import type { TrackId } from './trackSpec';
import { TRACK_CATALOG } from './trackSpec';
import { BedGraphLane } from './BedGraphLane';
import { BigwigLane } from './BigwigLane';
import { BigwigStacked } from './BigwigStackedLane';
import { GeneLane } from './GeneLane';
import { InsulationLane } from './InsulationLane';
import { LoopTrack } from './LoopTrack';
import { PeiLane } from './PeiLane';
import { SvLane } from './SvLane';
import { TadBar } from './TadBar';

interface TracksModelProps {
  /** The active sub-tab id (e.g. 'rna_seq', 'ab', 'tad', ...) */
  tab: TrackId;
  /** Current single-sample id (used for non-bigwig tracks) */
  sampleId: string;
  /** Auxiliary track ids to render below the main track */
  aux: TrackId[];
  /** Multi-sample ids for bigwig overlay (undefined for non-bigwig tabs) */
  overlaySampleIds?: string[];
  /** Multi-sample metadata for coloring */
  overlayMeta?: Sample[];
}

export function TracksModel({
  tab,
  sampleId,
  aux,
  overlaySampleIds,
  overlayMeta,
}: TracksModelProps): JSX.Element {
  const mainSpec = TRACK_CATALOG[tab];

  if (tab === 'loop') {
    return <LoopTrack sampleId={sampleId} />;
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
      return <TadBar sampleId={sampleId} height={mainSpec.defaultHeight} />;
    }
    if (mainSpec.kind === 'gene') {
      return <GeneLane sampleId={sampleId} height={mainSpec.defaultHeight} />;
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
    const auxSpec = TRACK_CATALOG[auxId];
    if (auxSpec.kind === 'bigwig') {
      return (
        <BigwigLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'rna_seq'}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'bedGraph') {
      return (
        <BedGraphLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'ab'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'is') {
      return (
        <InsulationLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'is'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'pei') {
      return (
        <PeiLane
          sampleId={sampleId}
          trackName={auxSpec.trackName ?? 'pei'}
          title={auxSpec.title}
          height={auxSpec.defaultHeight}
        />
      );
    }
    if (auxSpec.kind === 'tadBar') {
      return <TadBar sampleId={sampleId} height={auxSpec.defaultHeight} />;
    }
    if (auxSpec.kind === 'gene') {
      return <GeneLane sampleId={sampleId} height={auxSpec.defaultHeight} />;
    }
    if (auxSpec.kind === 'sv') {
      return <SvLane sampleId={sampleId} title={auxSpec.title} height={auxSpec.defaultHeight} />;
    }
    return (
      <BigwigLane
        sampleId={sampleId}
        trackName={auxSpec.trackName ?? 'rna_seq'}
        height={auxSpec.defaultHeight}
      />
    );
  };

  return (
    <>
      {renderMain()}
      {aux.map((auxId) => (
        <div key={auxId}>{renderAux(auxId)}</div>
      ))}
    </>
  );
}

export default TracksModel;
