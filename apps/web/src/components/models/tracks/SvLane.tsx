import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchSV, type SVRecord } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildSv } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const SV_LANE_HEIGHT = 120;

interface SvLaneProps {
  sampleId: string;
  title: string;
  height?: number;
}

/**
 * Structural variants — per-kind coloured markers labelled DEL/DUP/INV/TRA.
 */
export function SvLane({
  sampleId,
  title,
  height = SV_LANE_HEIGHT,
}: SvLaneProps): JSX.Element {
  const viewport = useViewport();

  const { data, isLoading, error } = useQuery<SVRecord[]>({
    queryKey: [
      'sv',
      sampleId,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchSV(sampleId, viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildSv(data, viewport, title, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="sv"
        data-track-name="sv"
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