import { useMemo, type JSX } from 'react';
import { Link, useParams } from 'react-router-dom';

import { RouteShell } from '../../components/route/RouteShell';
import { useAppIntl } from '../../i18n';
import { useSampleCatalog } from '../../hooks/useSampleCatalog';
import { ModelFactory } from '../../components/models';
import type { ModelType } from '../../components/models';
import './explore.css';

/**
 * Viewer-type values that have a real ModelFactory component. The URL
 * `viewerType` param must be one of these for the preview to render the
 * actual model — anything else falls back to the placeholder.
 *
 * Typed as `readonly string[]` (not `Set<ModelType>`) because the
 * runtime MODEL_REGISTRY contains a `'tracks'` key that the exported
 * `ModelType` union does not include — a pre-existing inconsistency
 * that this file does not need to solve. The lookup below uses
 * `String.prototype.includes`, so widening to `string` is safe.
 */
const VALID_TYPES: readonly string[] = ['hic', 'tracks', '3d', 'ctcf-motif'];

/**
 * Viewer-type landing page. Each viewer (hic / tracks / 3d / ctcfMotif)
 * gets a dedicated landing that:
 *  1. Renders the viewer with a default sample (the catalog's first
 *     sample) so the user immediately sees what the visualization looks
 *     like
 *  2. Shows a "data legend" — short descriptions of what each visual
 *     element represents (heatmap axes, lane types, organ labels, etc.)
 *  3. Lists every sample so the user can pick one to view its real data
 *
 * Acts as the entry point for viewer-type "exploration" — instead of
 * picking a sample first, the user can learn what each viewer shows,
 * then drill into a specific sample from the list below.
 */
export function Explore(): JSX.Element {
  const { t } = useAppIntl();
  const { viewerType = 'hic' } = useParams<{ viewerType: string }>();
  const { samples } = useSampleCatalog();

  const sortedSamples = useMemo(
    () => (samples ?? []).slice().sort((a, b) => a.id.localeCompare(b.id)),
    [samples],
  );

  const defaultSample = sortedSamples[0];

  const meta = EXPLORE_META[viewerType] ?? EXPLORE_META.hic;

  const canRenderModel =
    defaultSample !== undefined && VALID_TYPES.includes(viewerType);

  return (
    <RouteShell title={meta.title} subtitle={meta.subtitle}>
      {/* ── Visual preview + legend ── */}
      <div className="explore-preview">
        <div className="explore-preview__visual">
          {canRenderModel && defaultSample ? (
            <>
              <div className="explore-preview__sample-label">
                {t('explore.preview.sampleLabel', { id: defaultSample.id })}
              </div>
              <ModelFactory type={viewerType as ModelType} />
            </>
          ) : (
            meta.preview ?? <DefaultPreview viewer={viewerType} />
          )}
        </div>
        <div className="explore-preview__legend">
          <h3>{t('explore.legend.title')}</h3>
          <dl>
            {meta.legend.map(({ term, descKey }) => (
              <div key={term} className="explore-legend-item">
                <dt>{term}</dt>
                <dd>{t(descKey)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── Sample list (drill-down to /sample/:id) ── */}
      <div className="explore-samples">
        <h2>{t('explore.samples.heading', { count: sortedSamples.length })}</h2>
        <div className="explore-samples__grid">
          {sortedSamples.map((s) => (
            <Link
              key={s.id}
              className="explore-sample-card"
              to={`/sample/${s.id}`}
              data-viewer={viewerType}
            >
              <span className="explore-sample-card__id">{s.id}</span>
              <span className="explore-sample-card__meta">
                {s.tissue} · {s.breed} · {s.sex} · {s.dev_stage}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </RouteShell>
  );
}

/** Placeholder preview while the real viewer preview renders. */
function DefaultPreview({ viewer }: { viewer: string }): JSX.Element {
  return (
    <div className="explore-preview__placeholder" data-viewer={viewer}>
      <span>{viewer}</span>
    </div>
  );
}

interface ExploreMeta {
  title: string;
  subtitle: string;
  preview?: JSX.Element;
  legend: Array<{ term: string; descKey: string }>;
}

const EXPLORE_META: Record<string, ExploreMeta> = {
  hic: {
    title: 'Hi-C contact map',
    subtitle: 'Chromatin contact frequency heatmap · log scale',
    legend: [
      { term: 'X / Y axis', descKey: 'explore.legend.hic.axis' },
      { term: 'Color scale', descKey: 'explore.legend.hic.colorScale' },
      { term: 'Diagonal', descKey: 'explore.legend.hic.diagonal' },
      { term: 'Off-diagonal', descKey: 'explore.legend.hic.offDiagonal' },
    ],
  },
  tracks: {
    title: 'Multi-omics tracks',
    subtitle: 'Stacked coverage and annotation tracks for a genomic region',
    legend: [
      { term: 'Bigwig', descKey: 'explore.legend.tracks.bigwig' },
      { term: 'Bedgraph', descKey: 'explore.legend.tracks.bedgraph' },
      { term: 'TAD bar', descKey: 'explore.legend.tracks.tad' },
      { term: 'Gene model', descKey: 'explore.legend.tracks.gene' },
    ],
  },
  '3d': {
    title: '3D chromatin structure',
    subtitle: 'Per-organ random-walk backbone with PEI enhancer arcs',
    legend: [
      { term: 'Tube', descKey: 'explore.legend.threeD.tube' },
      { term: 'Sphere', descKey: 'explore.legend.threeD.sphere' },
      { term: 'Arc', descKey: 'explore.legend.threeD.arc' },
    ],
  },
  ctcfMotif: {
    title: 'CTCF motif & genotype',
    subtitle: 'Population-genetic variation at CTCF binding sites',
    legend: [
      { term: 'Logo', descKey: 'explore.legend.ctcf.logo' },
      { term: 'Pie', descKey: 'explore.legend.ctcf.pie' },
      { term: 'Anchor', descKey: 'explore.legend.ctcf.anchor' },
    ],
  },
};

export default Explore;