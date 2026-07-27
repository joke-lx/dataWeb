import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { PeiRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildPei } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const PEI_LANE_HEIGHT = 180;

interface PeiLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * PEI (Promoter-Enhancer Interaction) anchors — quadratic arcs from
 * interval start to end spanning the lane.
 */
export function PeiLane({
  sampleId,
  trackName,
  title,
  height = PEI_LANE_HEIGHT,
}: PeiLaneProps): JSX.Element {
  const viewport = useViewport();

  const { data, isLoading, error } = useQuery<PeiRecord[]>({
    queryKey: [
      'pei',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'pei'>(sampleId, 'pei', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildPei(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="pei"
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