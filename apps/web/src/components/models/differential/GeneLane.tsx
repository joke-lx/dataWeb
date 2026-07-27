import { useQuery } from '@tanstack/react-query';
import type { JSX } from 'react';

import { fetchBed } from '../../../api/client';
import type { GeneRecord } from '../../../api/types';
import { useViewport } from '../../../store/viewport';
import { PlotlyTrack } from '../../render-kit/plotly/PlotlyTrack';
import { buildGene } from '../../render-kit/plotlyBuilders';
import '../../render-kit/lane.css';

const GENE_LANE_HEIGHT = 120;

interface GeneLaneProps {
  /** Override the active sample. */
  sampleId?: string;
  /** Override the lane height in pixels. */
  height?: number;
}

/**
 * Gene annotation lane — intron backbones + exon rectangles stacked
 * across rows. Shared shape with the tracks view.
 */
export function GeneLane({
  sampleId,
  height = GENE_LANE_HEIGHT,
}: GeneLaneProps): JSX.Element {
  const viewport = useViewport();
  const resolvedSample = sampleId ?? 'Brain_BF3';

  const { data, isLoading, error } = useQuery<GeneRecord[]>({
    queryKey: [
      'gene',
      resolvedSample,
      viewport.chr,
      viewport.start,
      viewport.end,
    ],
    queryFn: () =>
      fetchBed<'gene'>(resolvedSample, 'gene', viewport.chr, viewport.start, viewport.end),
    staleTime: 30_000,
  });

  const plot = buildGene(data, viewport, 'Gene model', height);

  return (
    <div className="lane" style={{ height: `${height}px` }}>
      <div className="lane-label">
        <span className="lane-sample">{resolvedSample}</span>
      </div>
      <div
        className="lane-content"
        data-kind="gene"
        data-track-name="gene"
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