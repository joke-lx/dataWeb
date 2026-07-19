import { useState } from 'react';
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchBed, fetchBigwig } from '../../api/client';
import type { BedKind, BedRecordByKind } from '../../api/types';
import { useActiveSample } from '../../hooks/useActiveSample';
import { useViewport } from '../../store/viewport';
import { ColormapBar, type ColormapName } from '../hic/ColormapBar';
import { HiCMatrix2D } from '../hic/HiCMatrix2D';
import '../hic/hic.css';
import { LinearTrack, type LinearKind } from '../linear/LinearTrack';

type TrackKind = 'hic' | LinearKind;
type BigwigData = Awaited<ReturnType<typeof fetchBigwig>>;
type BedData = BedRecordByKind[BedKind][];
type LaneData = BigwigData | BedData;

const HEIGHTS: Record<TrackKind, number> = {
  hic: 480,
  bigwig: 48,
  bedGraph: 36,
  tadBar: 28,
  pei: 36,
  gene: 80,
};

interface LaneProps {
  kind: TrackKind;
  title: string;
  trackName?: string;
  bedKind?: BedKind;
  height?: number;
}

function isBigwigData(data: LaneData | undefined): data is BigwigData {
  return data !== undefined && !Array.isArray(data);
}

export function Lane({
  kind,
  title,
  trackName,
  bedKind,
  height,
}: LaneProps): JSX.Element {
  const viewport = useViewport();
  const activeSample = useActiveSample();
  const sampleId = activeSample ?? 'Brain_BF3';
  const laneHeight = height ?? HEIGHTS[kind];
  const [colorMap, setColorMap] = useState<ColormapName>('rdbu');

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
    ],
    queryFn: async () => {
      if (kind === 'bigwig' && trackName) {
        const viewportWidth = viewport.end - viewport.start;
        const bins = Math.min(
          400,
          Math.max(20, Math.ceil(viewportWidth / Math.max(1, viewport.bin))),
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
      if (kind !== 'hic' && bedKind) {
        return fetchBed(
          sampleId,
          bedKind,
          viewport.chr,
          viewport.start,
          viewport.end,
        );
      }
      throw new Error(`unsupported kind: ${kind}`);
    },
    enabled: kind !== 'hic',
    staleTime: 30_000,
  });

  if (kind === 'hic') {
    return (
      <div className="lane" style={{ height: `${laneHeight}px` }}>
        <div className="lane-label">
          <span className="lane-title">{title}</span>
          <span className="lane-sample">{sampleId}</span>
        </div>
        <div className="lane-content" data-kind={kind}>
          <div className="hic-lane-content">
            <HiCMatrix2D sampleId={sampleId} height={laneHeight - 32} />
            <ColormapBar
              vmin={0}
              vmax={6}
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
        />
      </div>
    </div>
  );
}
