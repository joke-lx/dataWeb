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
  BedKind,
  BedRecordByKind,
} from '../../api/types';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useViewport } from '../../store/viewport';
import { ColormapBar, type ColormapName } from '../hic/ColormapBar';
import { HiCMatrix2D } from '../hic/HiCMatrix2D';
import '../hic/hic.css';
import { LinearTrack, type LinearKind } from '../linear/LinearTrack';

type TrackKind = 'hic' | LinearKind;
type BigwigData = Awaited<ReturnType<typeof fetchBigwig>>;
type HicData = Awaited<ReturnType<typeof fetchHicMatrix>>;
type BedData = BedRecordByKind[BedKind][];
type SVData = Awaited<ReturnType<typeof fetchSV>>;
type LaneData = BigwigData | HicData | BedData | SVData;

const MAX_MATRIX_DIM = 512;

const HEIGHTS: Record<TrackKind, number> = {
  hic: 480,
  bigwig: 48,
  bedGraph: 36,
  tadBar: 28,
  pei: 36,
  gene: 80,
  is: 36,
  sv: 36,
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

function isBigwigData(data: LaneData | undefined): data is BigwigData {
  return data !== undefined && !Array.isArray(data) && 'values' in data;
}

function isHicData(data: LaneData | undefined): data is HicData {
  return data !== undefined && !Array.isArray(data) && 'matrix' in data;
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

  const bigwigData = isBigwigData(query.data) ? query.data : undefined;
  const data = kind === 'bigwig' ? bigwigData?.values : query.data;

  return (
    <div className="lane" style={{ height: `${laneHeight}px` }}>
      <div className="lane-label">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind={kind}
        data-track-name={trackName}
      >
        <LinearTrack
          kind={kind}
          sampleId={sampleId}
          trackName={trackName ?? kind}
          data={data}
          vmin={bigwigData?.vmin}
          vmax={bigwigData?.vmax}
          loading={query.isLoading}
          error={query.error}
          height={laneHeight}
          mirror={mirror}
        />
      </div>
    </div>
  );
}
