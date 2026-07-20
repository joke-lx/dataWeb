import { useState } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  fetchBed,
  fetchBigwig,
  fetchHicMatrix,
  fetchSV,
} from '../../api/client';
import type {
  BedGraphRecord,
  BedKind,
  BedRecordByKind,
  GeneRecord,
  PeiRecord,
  TadRecord,
} from '../../api/types';
import type { SVRecord } from '../../api/client';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useViewport, type Viewport } from '../../store/viewport';
import { ColormapBar, type ColormapName } from '../hic/ColormapBar';
import { HiCMatrix2D } from '../hic/HiCMatrix2D';
import '../hic/hic.css';
import { PlotlyTrack } from '../linear/PlotlyTrack';
import type { PlotlyBuild, PlotlyLayout } from '../linear/plotlyTypes';
import {
  buildBedGraph,
  buildBigwig,
  buildGene,
  buildInsulationScore,
  buildPei,
  buildSv,
  buildTadBar,
} from '../linear/kinds/plotlyBuilders';

export type LinearKind =
  | 'bigwig'
  | 'bedGraph'
  | 'tadBar'
  | 'pei'
  | 'gene'
  | 'is'
  | 'sv';

type TrackKind = 'hic' | LinearKind;
type BigwigData = Awaited<ReturnType<typeof fetchBigwig>>;
type HicData = Awaited<ReturnType<typeof fetchHicMatrix>>;
type BedData = BedRecordByKind[BedKind][];
type SVData = Awaited<ReturnType<typeof fetchSV>>;
type LaneData = BigwigData | HicData | BedData | SVData;
type LinearData = BigwigData | BedData | SVData;

const MAX_MATRIX_DIM = 512;

const HEIGHTS: Record<TrackKind, number> = {
  hic: 480,
  bigwig: 180,
  bedGraph: 150,
  tadBar: 120,
  pei: 180,
  gene: 120,
  is: 150,
  sv: 120,
};

interface LaneProps {
  kind: TrackKind;
  title: string;
  trackName?: string;
  bedKind?: BedKind;
  height?: number;
  /** Override the active sample (used by comparison mode). */
  sampleId?: string;
  /** Mirror bigwig fill direction (sample B in comparison mode). */
  mirror?: boolean;
}

function isBigwigData(data: LinearData | undefined): data is BigwigData {
  return data !== undefined && !Array.isArray(data) && 'values' in data;
}

/**
 * Translate the lane's data payload into a Plotly figure for the given linear
 * kind. The title is rendered by Plotly itself (see `PlotlyTrack`), so the
 * lane gutter only shows the sample id — no duplicate title.
 */
function buildLinearPlot(
  kind: LinearKind,
  data: LinearData | undefined,
  viewport: Viewport,
  title: string,
  height: number,
  mirror: boolean,
): PlotlyBuild {
  switch (kind) {
    case 'bigwig':
      return buildBigwig(
        isBigwigData(data) ? data.values : undefined,
        viewport,
        title,
        height,
        mirror,
      );
    case 'bedGraph':
      return buildBedGraph(
        data as BedGraphRecord[] | undefined,
        viewport,
        title,
        height,
      );
    case 'is':
      return buildInsulationScore(
        data as BedGraphRecord[] | undefined,
        viewport,
        title,
        height,
      );
    case 'tadBar':
      return buildTadBar(data as TadRecord[] | undefined, viewport, title, height);
    case 'pei':
      return buildPei(data as PeiRecord[] | undefined, viewport, title, height);
    case 'gene':
      return buildGene(data as GeneRecord[] | undefined, viewport, title, height);
    case 'sv':
      return buildSv(data as SVRecord[] | undefined, viewport, title, height);
  }
  // Unreachable — `LinearKind` is exhaustive above; kept for type safety.
  const empty: PlotlyLayout = { title: { text: title }, height };
  return { data: [], layout: empty };
}

export function Lane({
  kind,
  title,
  trackName,
  bedKind,
  height,
  sampleId: sampleIdOverride,
  mirror = false,
}: LaneProps): JSX.Element {
  const viewport = useViewport();
  const activeSample = useActiveSample();
  const sampleId = sampleIdOverride ?? activeSample ?? 'Brain_BF3';
  const laneHeight = height ?? HEIGHTS[kind];
  const [colorMap, setColorMap] = useState<ColormapName>('rdbu');
  const viewportWidth = viewport.end - viewport.start;
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  const hicBin = Math.max(
    viewport.bin,
    Math.ceil(targetBin / 1000) * 1000,
  );

  const query = useQuery<LaneData>({
    queryKey: [
      kind,
      sampleId,
      trackName,
      bedKind,
      viewport.chr,
      viewport.start,
      viewport.end,
      viewport.bin,
      hicBin,
    ],
    queryFn: async () => {
      if (kind === 'hic') {
        return fetchHicMatrix(
          sampleId,
          viewport.chr,
          viewport.start,
          viewport.end,
          hicBin,
        );
      }
      if (kind === 'bigwig' && trackName) {
        const bins = Math.max(
          50,
          Math.min(800, Math.ceil(viewportWidth / 1000)),
        );
        return fetchBigwig(
          sampleId,
          trackName,
          viewport.chr,
          viewport.start,
          viewport.end,
          bins,
        );
      }
      if (kind === 'sv') {
        return fetchSV(
          sampleId,
          viewport.chr,
          viewport.start,
          viewport.end,
        );
      }
      const resolvedBedKind = kind === 'is' ? 'is' : bedKind;
      if (resolvedBedKind) {
        return fetchBed(
          sampleId,
          resolvedBedKind,
          viewport.chr,
          viewport.start,
          viewport.end,
        );
      }
      throw new Error(`unsupported kind: ${kind}`);
    },
    staleTime: 30_000,
  });

  if (kind === 'hic') {
    const hicData = isHicData(query.data) ? query.data : undefined;
    return (
      <div className="lane" style={{ height: `${laneHeight}px` }}>
        <div className="lane-label">
          <span className="lane-title">{title}</span>
          <span className="lane-sample">{sampleId}</span>
        </div>
        <div className="lane-content" data-kind={kind}>
          <div className="hic-lane-content">
            <HiCMatrix2D
              sampleId={sampleId}
              data={hicData}
              loading={query.isLoading}
              error={query.error}
              colorMap={colorMap}
              vmin={hicData?.vmin}
              vmax={hicData?.vmax}
              bin={hicBin}
              height={laneHeight - 32}
            />
            <ColormapBar
              vmin={hicData?.vmin ?? 0}
              vmax={hicData?.vmax ?? 1}
              colorMap={colorMap}
              onChange={setColorMap}
            />
          </div>
        </div>
      </div>
    );
  }

  const plot = buildLinearPlot(
    kind,
    query.data as LinearData | undefined,
    viewport,
    title,
    laneHeight,
    mirror,
  );

  return (
    <div className="lane" style={{ height: `${laneHeight}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind={kind}
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={laneHeight} />
        {query.isLoading && <span className="track-loading">…</span>}
        {query.error && (
          <span className="track-error" title={query.error.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}

function isHicData(data: LaneData | undefined): data is HicData {
  return data !== undefined && !Array.isArray(data) && 'matrix' in data;
}
