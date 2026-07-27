import { useQueries } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBigwig } from '../../../api/client';
import type { Sample } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import {
  buildBigwig,
} from '../../render-kit/plotlyBuilders';
import { buildBigwigStacked, type BigwigSeries } from './BigwigStacked';
import { colorForTissue, type SampleColor } from './sampleColors';
import '../../render-kit/lane.css';

interface BigwigStackedProps {
  sampleIds: string[];
  sampleMeta?: Sample[];
  trackName: string;
  title: string;
  groupLabel?: string;
  highlightBands?: Array<{ start: number; end: number }>;
  height?: number;
}

/**
 * Multi-sample bigwig lane — one horizontal slice per sample id
 * (independent y-axis), shared x-axis. Falls back to single-sample
 * `buildBigwig` when there is exactly one id.
 */
export function BigwigStacked({
  sampleIds,
  sampleMeta,
  trackName,
  title,
  groupLabel,
  highlightBands,
  height,
}: BigwigStackedProps): JSX.Element {
  const viewport = useViewport();
  const viewportWidth = viewport.end - viewport.start;
  const bins = Math.max(50, Math.min(800, Math.ceil(viewportWidth / 1000)));

  const queries = useQueries({
    queries: sampleIds.map((id) => ({
      queryKey: [
        'bigwig-stacked',
        id,
        trackName,
        viewport.chr,
        viewport.start,
        viewport.end,
        bins,
      ],
      queryFn: () =>
        fetchBigwig(
          id,
          trackName,
          viewport.chr,
          viewport.start,
          viewport.end,
          bins,
        ),
      enabled: !!trackName,
      staleTime: 30_000,
    })),
  });

  const fallback: SampleColor = {
    line: '#666666',
    fill: 'rgba(102, 102, 102, 0.60)',
  };
  const series: BigwigSeries[] = sampleIds.map((id, i) => {
    const meta = sampleMeta?.[i];
    const c = meta ? colorForTissue(meta.tissue) : fallback;
    return {
      id,
      values: queries[i]?.data?.values,
      line: c.line,
      fill: c.fill,
    };
  });

  // Single-sample → single bigwig; ≥2 samples → demo-style stacked slices.
  const stackedLaneHeight =
    series.length === 1
      ? height ?? 180
      : Math.max(height ?? 180, 70 * series.length + 30);
  const plot =
    series.length === 1
      ? buildBigwig(series[0].values, viewport, title, stackedLaneHeight)
      : buildBigwigStacked(
          series,
          viewport,
          title,
          stackedLaneHeight,
          groupLabel ?? title,
          highlightBands,
        );

  const overlayError = queries.find((q) => q.error)?.error ?? null;
  const overlayLoading = queries.some((q) => q.isLoading);

  return (
    <div
      className="lane lane--stacked"
      style={{ height: `${stackedLaneHeight}px` }}
    >
      <div className="lane-label lane-label--stacked">
        <span className="lane-title">{title}</span>
        <span className="lane-sample">
          {sampleIds.length > 2
            ? `${sampleIds.slice(0, 2).join(', ')} +${sampleIds.length - 2}`
            : sampleIds.join(', ')}
        </span>
      </div>
      <div
        className="lane-content"
        data-kind="bigwig"
        data-track-name={trackName}
      >
        {series.every((s) => !s.values) ? (
          <span className="placeholder">No samples selected</span>
        ) : (
          <PlotlyTrack data={plot.data} layout={plot.layout} height={stackedLaneHeight} />
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