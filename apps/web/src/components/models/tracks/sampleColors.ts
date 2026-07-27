/**
 * Sample → colormap mapping for multi-sample track overlays.
 *
 * Colors are sampled from `docx/refrences/demo/tracks_offline.html:3927-3933`
 * (Berkshire / Tibetan / F1 palette). Each tissue maps to a {line, fill} pair:
 * - `line` — opaque stroke color (width 0.8 px)
 * - `fill` — semi-transparent fill color (60% alpha) used with `fill: 'tozeroy'`
 *
 * Tissues outside the known set (Unknown / Pituitary / etc.) fall back to the
 * track's default token via `colorForTissue(tissue).line === fallback.line`.
 */

export interface SampleColor {
  /** Stroke color for the trace line. */
  line: string;
  /** Fill color for `fill: 'tozeroy'` (already includes alpha). */
  fill: string;
}

const PALETTE: Record<string, SampleColor> = {
  Muscle: {
    // Berkshire (orange/tan)
    line: '#B5793B',
    fill: 'rgba(196, 138, 62, 0.60)',
  },
  Liver: {
    // Tibetan (blue)
    line: '#3E6DA3',
    fill: 'rgba(84, 127, 173, 0.60)',
  },
  Brain: {
    // Hybrid F1 (green)
    line: '#2F8F4E',
    fill: 'rgba(60, 160, 90, 0.65)',
  },
};

const FALLBACK: SampleColor = {
  // Neutral gray for tissues outside the catalog.
  line: '#666666',
  fill: 'rgba(102, 102, 102, 0.60)',
};

/**
 * Resolve the {line, fill} pair for a tissue name.
 * Unknown / undefined tissues return the fallback palette.
 */
export function colorForTissue(tissue: string | undefined | null): SampleColor {
  if (!tissue) return FALLBACK;
  return PALETTE[tissue] ?? FALLBACK;
}