import type { BedGraphRecord, GeneRecord, PeiRecord, TadRecord } from '../../../api/types';
import type { SVRecord } from '../../../api/client';
import type { Viewport } from '../../../store/viewport';
import type { PlotlyBuild, PlotlyData, PlotlyLayout } from '../plotlyTypes';

/** Read a CSS custom property from :root, falling back when unset/empty. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Append an alpha channel to a `#rrggbb` color (returns rgba() for safety). */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

interface BaseLayoutOpts {
  xaxis?: { [key: string]: unknown };
  yaxis?: { [key: string]: unknown };
  shapes?: Array<{ [key: string]: unknown }>;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
}

/**
 * Shared layout shell so every track lines up on the same genomic x-scale and
 * inherits the demo.html aesthetic: tight margins, compact title, light grid,
 * transparent background so the lane surface shows through.
 */
function baseLayout(
  viewport: Viewport,
  title: string,
  height: number,
  opts: BaseLayoutOpts = {},
): PlotlyLayout {
  const {
    xaxis = {},
    yaxis = {},
    shapes,
    marginTop = 24,
    marginBottom = 28,
    marginLeft = 46,
    marginRight = 8,
  } = opts;
  const layout: PlotlyLayout = {
    title: { text: title, font: { size: 12, color: '#555' } },
    height,
    margin: { t: marginTop, b: marginBottom, l: marginLeft, r: marginRight },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { size: 10, color: '#666' },
    hovermode: false,
    xaxis: {
      range: [viewport.start, viewport.end],
      tickformat: '.2s',
      showgrid: false,
      zeroline: false,
      tickfont: { size: 9 },
      ...xaxis,
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 9 },
      linecolor: '#D9D9D7',
      linewidth: 1,
      showline: true,
      ...yaxis,
    },
  };
  if (shapes) layout.shapes = shapes;
  return layout;
}

/** RNA-seq / histone mark signal track (filled area curve, positive direction). */
export function buildBigwig(
  values: Float32Array | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const color = cssVar('--sample-a', '#c0392b');
  const n = values?.length ?? 0;
  const binBp = n > 0 ? (viewport.end - viewport.start) / n : 1;
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i += 1) {
    x.push(viewport.start + (i + 0.5) * binBp);
    y.push(values![i]);
  }
  const data: PlotlyData[] = [
    {
      x,
      y,
      type: 'scatter',
      mode: 'lines',
      line: { color, width: 0.8 },
      fill: 'tozeroy',
      fillcolor: withAlpha(color, 0.60),
      hoverinfo: 'skip',
    },
  ];
  return {
    data,
    layout: baseLayout(viewport, title, height, {
      yaxis: { rangemode: 'nonnegative' },
    }),
  };
}

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

/** AB compartment index: signed curve with red (A) above zero, blue (B) below. */
export function buildBedGraph(
  records: BedGraphRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const colorA = cssVar('--color-a-compartment', '#c0392b');
  const colorB = cssVar('--color-b-compartment', '#2c5fa6');
  const visible = (records ?? []).filter((r) => r.chrom === viewport.chr);
  const x = visible.map((r) => (r.start + r.end) / 2);
  const data: PlotlyData[] = [
    {
      x,
      y: visible.map((r) => Math.max(0, r.score)),
      type: 'scatter',
      mode: 'lines',
      line: { width: 0 },
      fill: 'tozeroy',
      fillcolor: withAlpha(colorA, 0.60),
      hoverinfo: 'skip',
    },
    {
      x,
      y: visible.map((r) => Math.min(0, r.score)),
      type: 'scatter',
      mode: 'lines',
      line: { width: 0 },
      fill: 'tozeroy',
      fillcolor: withAlpha(colorB, 0.60),
      hoverinfo: 'skip',
    },
    {
      x,
      y: visible.map((r) => r.score),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#333', width: 1, shape: 'spline' },
      hoverinfo: 'skip',
    },
  ];
  const shapes = [
    {
      type: 'line',
      x0: 0,
      x1: 1,
      xref: 'paper',
      y0: 0,
      y1: 0,
      yref: 'y',
      line: { color: 'rgba(0,0,0,0.35)', width: 1 },
    },
  ];
  return {
    data,
    layout: baseLayout(viewport, title, height, { shapes }),
  };
}

/** Insulation score: smooth line with a faint fill (matches demo.html). */
export function buildInsulationScore(
  records: BedGraphRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const visible = (records ?? []).filter((r) => r.chrom === viewport.chr);
  const x = visible.map((r) => (r.start + r.end) / 2);
  const data: PlotlyData[] = [
    {
      x,
      y: visible.map((r) => r.score),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#444', width: 1.5, shape: 'spline' },
      fill: 'tozeroy',
      fillcolor: 'rgba(70,70,70,0.08)',
      hoverinfo: 'skip',
    },
  ];
  return {
    data,
    layout: baseLayout(viewport, title, height, {
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: 0,
          y1: 0,
          yref: 'y',
          line: { color: 'rgba(0,0,0,0.25)', width: 1 },
        },
      ],
    }),
  };
}

/** TAD domains: full-height rectangles spanning each domain interval. */
export function buildTadBar(
  records: TadRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const body = cssVar('--color-tad-body', '#f5f5f5');
  const boundary = cssVar('--color-tad-boundary', '#1a1a1a');
  const shapes = (records ?? [])
    .filter((r) => r.chrom === viewport.chr)
    .map((r) => ({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: r.start,
      x1: r.end,
      y0: 0,
      y1: 1,
      fillcolor: body,
      line: { color: boundary, width: 1 },
    }));
  return {
    data: [],
    layout: baseLayout(viewport, title, height, {
      yaxis: { visible: false, range: [0, 1] },
      shapes,
      marginTop: 22,
      marginBottom: 24,
    }),
  };
}

/** PEI anchors: quadratic arcs from interval start to end spanning the lane. */
export function buildPei(
  records: PeiRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const color = cssVar('--color-pei-anchor', '#d4a017');
  const shapes = (records ?? [])
    .filter(
      (r) => r.chrom === viewport.chr && r.end > viewport.start && r.start < viewport.end,
    )
    .map((r) => {
      const cx = (r.start + r.end) / 2;
      return {
        type: 'path',
        xref: 'x',
        yref: 'paper',
        path: `M ${r.start} 0 Q ${cx} 1 ${r.end} 0`,
        line: { color, width: 1.5 },
      };
    });
  return {
    data: [],
    layout: baseLayout(viewport, title, height, {
      yaxis: { visible: false, range: [0, 1] },
      shapes,
    }),
  };
}

/** Structural variants: per-kind coloured markers labelled DEL/DUP/INV/TRA. */
export function buildSv(
  records: SVRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const palette: Record<SVRecord['kind'], string> = {
    DEL: cssVar('--color-sv-del', '#b5305d'),
    DUP: cssVar('--color-sv-dup', '#2e8b57'),
    INV: cssVar('--color-sv-inv', '#6e4ca0'),
    TRA: cssVar('--color-sv-tra', '#444444'),
  };
  const visible = (records ?? []).filter(
    (r) => r.chrom === viewport.chr && r.end >= viewport.start && r.start <= viewport.end,
  );
  const data: PlotlyData[] = [
    {
      x: visible.map((r) => (r.start + r.end) / 2),
      y: visible.map(() => 1),
      type: 'scatter',
      mode: 'markers+text',
      text: visible.map((r) => r.kind),
      textposition: 'top center',
      textfont: { size: 9 },
      marker: {
        color: visible.map((r) => palette[r.kind] ?? '#444444'),
        size: 12,
        symbol: 'triangle-down',
      },
      showlegend: false,
      hoverinfo: 'skip',
    },
  ];
  return {
    data,
    layout: baseLayout(viewport, title, height, {
      yaxis: { visible: false, range: [0, 2] },
    }),
  };
}

/** Gene annotation: intron backbones + exon rectangles, stacked across rows. */
export function buildGene(
  records: GeneRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const exonColor = cssVar('--color-gene-exon', '#26417f');
  const intronColor = cssVar('--color-gene-intron', '#26417f');

  interface GeneAccum {
    start: number;
    end: number;
    strand: string;
    exons: Array<{ start: number; end: number }>;
  }
  const byGene = new Map<string, GeneAccum>();
  for (const r of records ?? []) {
    if (r.chrom !== viewport.chr) continue;
    const gene = byGene.get(r.gene_name) ?? {
      start: r.start,
      end: r.end,
      strand: r.strand,
      exons: [],
    };
    gene.start = Math.min(gene.start, r.start);
    gene.end = Math.max(gene.end, r.end);
    if (r.is_exon) gene.exons.push({ start: r.start, end: r.end });
    byGene.set(r.gene_name, gene);
  }

  const rows = 4;
  const topPad = 0.06;
  const usable = 0.88;
  const rowHeight = usable / rows;
  const bandHalf = rowHeight * 0.32;

  const shapes: Array<{ [key: string]: unknown }> = [];
  let rowIndex = 0;
  for (const gene of byGene.values()) {
    const mid = topPad + rowHeight * (rowIndex % rows) + rowHeight / 2;
    shapes.push({
      type: 'line',
      xref: 'x',
      yref: 'paper',
      x0: gene.start,
      x1: gene.end,
      y0: mid,
      y1: mid,
      line: { color: intronColor, width: 1 },
    });
    for (const exon of gene.exons) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: exon.start,
        x1: exon.end,
        y0: mid - bandHalf,
        y1: mid + bandHalf,
        fillcolor: exonColor,
        line: { width: 0 },
      });
    }
    rowIndex += 1;
  }

  return {
    data: [],
    layout: baseLayout(viewport, title, height, {
      yaxis: { visible: false, range: [0, 1] },
      shapes,
    }),
  };
}
