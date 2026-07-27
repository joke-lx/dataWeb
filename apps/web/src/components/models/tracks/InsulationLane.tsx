import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { BedGraphRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildInsulationScore } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const INSULATION_LANE_HEIGHT = 150;

interface InsulationLaneProps {
  sampleId: string;
  trackName: string;
  title: string;
  height?: number;
}

/**
 * Insulation score lane — smooth line with a faint fill (matches demo.html).
 */
export function InsulationLane({
  sampleId,
  trackName,
  title,
  height = INSULATION_LANE_HEIGHT,
}: InsulationLaneProps): JSX.Element {
  const viewport = useViewport();

  const { data, isLoading, error } = useQuery<BedGraphRecord[]>({
    queryKey: [
      'is',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'is'>(sampleId, 'is', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildInsulationScore(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="is"
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