import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig } from '../../../api/client';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildBigwig } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const BIGWIG_LANE_HEIGHT = 180;

interface BigwigLaneProps {
  /** Active sample id. */
  sampleId: string;
  /** Track name (e.g. "rna_seq"). */
  trackName: string;
  /** Override the lane height in pixels. */
  height?: number;
}

/**
 * Single-sample bigwig lane — RNA-seq / histone mark signal track.
 */
export function BigwigLane({
  sampleId,
  trackName,
  height = BIGWIG_LANE_HEIGHT,
}: BigwigLaneProps): JSX.Element {
  const viewport = useViewport();
  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'bigwig',
      sampleId,
      trackName,
      viewport.chr,
      viewport.start,
      viewport.end,
      bins,
    ],
    queryFn: () =>
      fetchBigwig(
        sampleId,
        trackName,
        viewport.chr,
        viewport.start,
        viewport.end,
        bins,
      ),
    enabled: !!trackName,
    staleTime: 30_000,
  });

  const plot = buildBigwig(data?.values, viewport, trackName, height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{sampleId}</span>
      </div>
      <div
        className="lane-content"
        data-kind="bigwig"
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