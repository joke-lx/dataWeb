import { useState } from 'react';
import type { JSX } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';

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
import type { Sample } from '../../api/types';
import { colorForTissue, type SampleColor } from '../tracks/sampleColors';
import { ColormapBar, type ColormapName } from '../hic/ColormapBar';
import { HiCMatrix2D } from '../hic/HiCMatrix2D';
import '../hic/hic.css';
import { PlotlyTrack } from '../linear/PlotlyTrack';
import type { PlotlyBuild, PlotlyLayout } from '../linear/plotlyTypes';
import {
  buildBedGraph,
  buildBigwig,
  buildBigwigOverlay,
  type BigwigSeries,
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
  /** Override the active sample. */
  sampleId?: string;
  /**
   * Multi-sample overlay (only honoured for `kind === 'bigwig'`). When set,
   * the lane fans out one `fetchBigwig` per id and renders them as stacked
   * traces. The companion `sampleMeta` array carries the matching `Sample`
   * metadata in the same order; without it a fallback gray palette is used.
   * Ignored for other kinds.
   */
  sampleIds?: string[];
  /**
   * Per-sample metadata aligned with `sampleIds` (only used with multi-sample).
   * When omitted, the lane falls back to a uniform gray palette (useful for
   * tests and the legacy single-sample path).
   */
  sampleMeta?: Sample[];
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
): PlotlyBuild {
  switch (kind) {
    case 'bigwig':
      return buildBigwig(
        isBigwigData(data) ? data.values : undefined,
        viewport,
        title,
        height,
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
  sampleIds,
  sampleMeta,
}: LaneProps): JSX.Element {
  const viewport = useViewport();
  const activeSample = useActiveSample();
  const sampleId = sampleIdOverride ?? activeSample ?? 'Brain_BF3';
  const laneHeight = height ?? HEIGHTS[kind];
  const [colorMap, setColorMap] = useState<ColormapName>('ref');
  const viewportWidth = viewport.end - viewport.start;
  const targetBin = Math.ceil(viewportWidth / MAX_MATRIX_DIM);
  const hicBin = Math.max(
    viewport.bin,
    Math.ceil(targetBin / 1000) * 1000,
  );

  // Multi-sample path: only for bigwig. Each sample becomes its own query.
  const isOverlay = kind === 'bigwig' && sampleIds !== undefined && sampleIds.length > 0;
  const singleId = isOverlay ? sampleIds![0] : sampleId;
  const bins = isOverlay
    ? Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)))
    : 0;

  const singleQuery = useQuery<LaneData>({
    queryKey: [
      kind,
      singleId,
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
          singleId,
          viewport.chr,
          viewport.start,
          viewport.end,
          hicBin,
        );
      }
      if (kind === 'bigwig' && trackName) {
        return fetchBigwig(
          singleId,
          trackName,
          viewport.chr,
          viewport.start,
          viewport.end,
          bins,
        );
      }
      if (kind === 'sv') {
        return fetchSV(
          singleId,
          viewport.chr,
          viewport.start,
          viewport.end,
        );
      }
      const resolvedBedKind = kind === 'is' ? 'is' : bedKind;
      if (resolvedBedKind) {
        return fetchBed(
          singleId,
          resolvedBedKind,
          viewport.chr,
          viewport.start,
          viewport.end,
        );
      }
      throw new Error(`unsupported kind: ${kind}`);
    },
    enabled: !isOverlay, // single query suppressed when overlay is in play
    staleTime: 30_000,
  });

  const overlayQueries = useQueries({
    queries: isOverlay
      ? sampleIds!.map((id) => ({
          queryKey: [
            kind,
            id,
            trackName,
            bedKind,
            viewport.chr,
            viewport.start,
            viewport.end,
            viewport.bin,
            bins,
          ],
          queryFn: () =>
            fetchBigwig(
              id,
              trackName!,
              viewport.chr,
              viewport.start,
              viewport.end,
              bins,
            ),
          enabled: !!trackName,
          staleTime: 30_000,
        }))
      : [],
  });

  if (kind === 'hic') {
    const hicData = isHicData(singleQuery.data) ? singleQuery.data : undefined;
    return (
      <div className="lane" style={{ height: `${laneHeight}px` }}>
        <div className="lane-label">
          <span className="lane-title">{title}</span>
          <span className="lane-sample">{sampleId}</span>
        </div>
        <div className="hic-lane" style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', flex: '1 1 auto', minWidth: 0 }}>
          <ColormapBar
            vmin={hicData?.vmin ?? 0}
            vmax={hicData?.vmax ?? 1}
            colorMap={colorMap}
            onChange={setColorMap}
          />
          <HiCMatrix2D
            sampleId={sampleId}
            data={hicData}
            loading={singleQuery.isLoading}
            error={singleQuery.error}
            colorMap={colorMap}
            vmin={hicData?.vmin}
            vmax={hicData?.vmax}
            bin={hicBin}
            height={laneHeight - 32}
          />
        </div>
      </div>
    );
  }

  // ---- Multi-sample bigwig overlay path ----
  if (isOverlay) {
    const overlayError = overlayQueries.find((q) => q.error)?.error ?? null;
    const overlayLoading = overlayQueries.some((q) => q.isLoading);
    const fallback: SampleColor = {
      line: '#c0392b',
      fill: 'rgba(192, 57, 43, 0.60)',
    };
    const series: BigwigSeries[] = sampleIds!.map((id, i) => {
      const meta = sampleMeta?.[i];
      const c = meta ? colorForTissue(meta.tissue) : fallback;
      return {
        id,
        values: overlayQueries[i]?.data?.values,
        line: c.line,
        fill: c.fill,
      };
    });
    const plot = buildBigwigOverlay(series, viewport, title, laneHeight);

    return (
      <div className="lane" style={{ height: `${laneHeight}px` }}>
        <div className="lane-label">
          <span className="lane-sample">
            {sampleIds!.length > 2
              ? `${sampleIds!.slice(0, 2).join(', ')} +${sampleIds!.length - 2}`
              : sampleIds!.join(', ')}
          </span>
        </div>
        <div
          className="lane-content"
          data-kind={kind}
          data-track-name={trackName}
        >
          {series.every((s) => !s.values) ? (
            <span className="placeholder">No samples selected</span>
          ) : (
            <PlotlyTrack data={plot.data} layout={plot.layout} height={laneHeight} />
          )}
          {overlayLoading && <span className="track-loading">…</span>}
          {overlayError && (
            <span className="track-error" title={overlayError.message}>
              !
            </span>
          )}
        </div>
      </div>
    );
  }

  // ---- Standard single-sample linear track path ----
  const plot = buildLinearPlot(
    kind,
    singleQuery.data as LinearData | undefined,
    viewport,
    title,
    laneHeight,
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
        {singleQuery.isLoading && <span className="track-loading">…</span>}
        {singleQuery.error && (
          <span className="track-error" title={singleQuery.error.message}>
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
