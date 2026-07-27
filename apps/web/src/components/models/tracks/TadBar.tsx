import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { TadRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildTadBar } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const TAD_LANE_HEIGHT = 120;

interface TadBarProps {
  /** Override the active sample. */
  sampleId?: string;
  /** Override the lane height in pixels. */
  height?: number;
}

/**
 * TAD (Topologically Associating Domain) boundary bar — full-height
 * rectangles spanning each domain interval along the genome axis.
 */
export function TadBar({
  sampleId,
  height = TAD_LANE_HEIGHT,
}: TadBarProps): JSX.Element {
  const viewport = useViewport();
  const resolvedSample = sampleId ?? 'Brain_BF3';

  const { data, isLoading, error } = useQuery<TadRecord[]>({
    queryKey: [
      'tadBar',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'tad'>(resolvedSample, 'tad', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildTadBar(data, viewport, 'TAD boundary', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="tadBar"
        data-track-name="tad"
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