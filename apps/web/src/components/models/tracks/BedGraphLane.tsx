import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { BedGraphRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBedGraph } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BEDGRAPH_LANE_HEIGHT = 150;

interface BedGraphLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * AB compartment index lane — signed curve with red (A) above zero,
 * blue (B) below.
 */
export function BedGraphLane({
  sampleId,
  trackName,
  title,
  height = BEDGRAPH_LANE_HEIGHT,
}: BedGraphLaneProps): JSX.Element {
  const viewport = useViewport();

  const { data, isLoading, error } = useQuery<BedGraphRecord[]>({
    queryKey: [
      'bedGraph',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'ab'>(sampleId, 'ab', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildBedGraph(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="bedGraph"
        data-track-name={trackName}
      >
        <PlotlyTrack data={plot.data} layout={plot.layout} height={height} />
        {isLoading && <span className="track-loading">…</span>}
        {error && (
          <span className="track-error" title={error.message}>
            !
          </span>
        )}
      </div>
    </div>
  );
}