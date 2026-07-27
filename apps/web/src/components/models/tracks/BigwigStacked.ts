import type { PlotlyBuild, PlotlyData, PlotlyLayout } from '../../render-kit/plotly/plotlyTypes';
import { baseLayout } from '../../render-kit/plotlyBuilders';
import type { Viewport } from '../../../store/viewport';

/**
 * Per-sample bigwig series — one entry per sample id in a multi-sample
 * lane. Used by `buildBigwigStacked` (N horizontal slices) and the older
 * `buildBigwigOverlay` (N traces sharing one y-axis).
 */
export interface BigwigSeries {
  /** Sample id, surfaced as the trace name for the right-side legend. */
  id: string;
  values: Float32Array | undefined;
  line: string;
  fill: string;
}

/**
 * Multi-sample bigwig layout: each sample gets its own horizontal slice
 * (independent y-axis) inside a single Plotly figure that shares one
 * genomic x-axis across all slices. This mirrors
 *
 * Slice geometry (top → bottom):
 *   - Even gaps of `0.012 * height` between slices (matches demo).
 *   - First slice has top padding `0.055 * height`; last slice ends flush
 *     with the bottom margin.
 *
 * Annotations:
 *   - Right side (`xref:'paper' x=1.005`): sample id, color-matched.
 *   - Left side  (`xref:'paper' x=-0.09`): group name rotated −90°,
 *     vertically centred across the whole stack so the label spans the
 *     lanes that belong to the same group.
 *
 * Highlight bands (`xref:'paper'` shapes) span the full vertical extent of
 * the stack. The x-axis is shared across slices so zooming and pan keep
 * every slice aligned.
 *
 * Note: the original `buildBigwigOverlay` (single y-axis, N traces) is
 * still exported for any future caller that prefers overlay semantics.
 * Today the `/tracks` route uses `buildBigwigStacked` for N≥2 and falls
 * back to `buildBigwig` for N=1.
 */
export function buildBigwigStacked(
  series: BigwigSeries[],
  viewport: Viewport,
  // Title is intentionally not rendered — the demo-style layout conveys
  // identity via the rotated group label on the left and the per-sample
  // labels on the right. Kept in the signature so the Lane caller doesn't
  // need to fork its invocation per lane kind.
  _title: string,
  height: number,
  groupLabel: string,
  highlightBands?: Array<{ start: number; end: number }>,
): PlotlyBuild {
  const data: PlotlyData[] = [];
  const layout: PlotlyLayout = baseLayout(viewport, '', height, {
    marginTop: 18,
    marginBottom: 22,
    marginLeft: 80,
    marginRight: 90,
  });

  const n = series.length;
  if (n === 0) return { data, layout };

  // ── Slice yaxis allocation ──────────────────────────────────────────
  // mirrors demo's domain[] = [top, bot] for each slice, gap=0.012
  const topPad = 0.055;
  const gap = 0.012;
  const botPad = 0.08;
  const avail = 1 - topPad - botPad - gap * (n - 1);
  const sliceH = avail / n;
  const domains: Array<[number, number]> = [];
  let cur = 1 - topPad;
  for (let i = 0; i < n; i += 1) {
    domains.push([Math.max(0, cur - sliceH), cur]);
    cur -= sliceH + gap;
  }

  // Per-slice ymax: prefer an actual data peak; fall back to 1 so the
  // axis still shows a meaningful tick. Demo hard-codes per-panel ymax;
  // here we pick the 99th percentile of each sample's positive values
  // so the curve fills the slice without hugging the ceiling.
  const ymaxOf = (s: BigwigSeries): number => {
    const v = s.values;
    if (!v || v.length === 0) return 1;
    const positives: number[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const x = v[i];
      if (x > 0) positives.push(x);
    }
    if (positives.length === 0) return 1;
    positives.sort((a, b) => a - b);
    const p99 = positives[Math.floor(positives.length * 0.99)];
    return Math.max(1, Math.ceil(p99));
  };

  // ── Slice data + per-slice yaxis ────────────────────────────────────
  const xAxisKey = 'x';
  layout[xAxisKey] = {
    range: [viewport.start, viewport.end],
    tickformat: '.2s',
    showgrid: false,
    zeroline: false,
    tickfont: { size: 9 },
    anchor: `y${n}`,
  };

  const binBp =
    series[0].values && series[0].values.length > 0
      ? (viewport.end - viewport.start) / series[0].values.length
      : 1;

  for (let i = 0; i < n; i += 1) {
    const s = series[i];
    const axId = i === 0 ? '' : String(i + 1);
    const yaxKey = `yaxis${axId}`;
    const yref = `y${axId}`;
    const x: number[] = [];
    const y: number[] = [];
    const nv = s.values?.length ?? 0;
    for (let k = 0; k < nv; k += 1) {
      x.push(viewport.start + (k + 0.5) * binBp);
      y.push(s.values![k]);
    }
    if (nv > 0) {
      data.push({
        x,
        y,
        type: 'scatter',
        mode: 'lines',
        xaxis: xAxisKey,
        yaxis: yref,
        name: s.id,
        line: { color: s.line, width: 0.8 },
        fill: 'tozeroy',
        fillcolor: s.fill,
        hoverinfo: 'skip',
      });
    }
    const ymax = ymaxOf(s);
    layout[yaxKey] = {
      domain: domains[i],
      range: [0, ymax],
      tickvals: [0, ymax],
      ticktext: ['0', String(ymax)],
      tickfont: { size: 9, color: '#7D7A75' },
      ticklen: 2,
      showgrid: false,
      zeroline: false,
      linecolor: '#D9D9D7',
      linewidth: 1,
      showline: true,
      mirror: false,
      rangemode: 'nonnegative',
    };
  }

  // ── Cross-slice highlight bands (xref: x, yref: paper) ──────────────
  // Demo's bands cover the full vertical extent of the waveform block.
  const shapes: Array<{ [key: string]: unknown }> = [];
  if (highlightBands && highlightBands.length > 0 && n > 0) {
    const bandTop = domains[0][1];
    const bandBot = domains[n - 1][0];
    for (const band of highlightBands) {
      if (band.end <= viewport.start || band.start >= viewport.end) continue;
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: Math.max(band.start, viewport.start),
        x1: Math.min(band.end, viewport.end),
        y0: bandBot,
        y1: bandTop,
        fillcolor: 'rgba(150,150,150,0.16)',
        line: { width: 0 },
        layer: 'below',
      });
    }
  }

  // ── Annotations: right-side sample labels + left-side group label ───
  const annotations: Array<{ [key: string]: unknown }> = [];
  for (let i = 0; i < n; i += 1) {
    const s = series[i];
    const yref = `y${i === 0 ? '' : i + 1}`;
    annotations.push({
      xref: 'paper',
      yref,
      x: 1.005,
      y: (domains[i][0] + domains[i][1]) / 2,
      xanchor: 'left',
      yanchor: 'middle',
      text: s.id,
      showarrow: false,
      font: { size: 10, color: s.line },
    });
  }
  // Group label — rotated -90° on the paper left margin, vertically
  // centred across the full stack.
  const groupY = (domains[0][1] + domains[n - 1][0]) / 2;
  annotations.push({
    xref: 'paper',
    yref: 'paper',
    x: -0.085,
    y: groupY,
    xanchor: 'center',
    yanchor: 'middle',
    text: groupLabel,
    textangle: -90,
    showarrow: false,
    font: { size: 12, color: '#2C2C2B' },
  });

  // Suppress the per-figure Plotly title — group label + sample labels
  // already convey the same info and the stacked slices need every
  // vertical pixel.
  if (layout.title) layout.title = { text: '' };

  if (shapes.length > 0) {
    layout.shapes = [...(layout.shapes ?? []), ...shapes];
  }
  if (annotations.length > 0) {
    layout.annotations = annotations as unknown as PlotlyLayout['annotations'];
  }
  return { data, layout };
}
