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
  } = opts;
  const layout: PlotlyLayout = {
    title: { text: title, font: { size: 12, color: '#555' } },
    height,
    margin: { t: marginTop, b: marginBottom, l: 46, r: 8 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { size: 10, color: '#666' },
    hovermode: false,
    xaxis: {
      range: [viewport.start, viewport.end],
      tickformat: '.2s',
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.06)',
      zeroline: false,
      tickfont: { size: 9 },
      ...xaxis,
    },
    yaxis: {
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.06)',
      zeroline: false,
      tickfont: { size: 9 },
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
      line: { color, width: 1.2 },
      fill: 'tozeroy',
      fillcolor: withAlpha(color, 0.35),
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
      fillcolor: withAlpha(colorA, 0.4),
      hoverinfo: 'skip',
    },
    {
      x,
      y: visible.map((r) => Math.min(0, r.score)),
      type: 'scatter',
      mode: 'lines',
      line: { width: 0 },
      fill: 'tozeroy',
      fillcolor: withAlpha(colorB, 0.4),
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
  const exonColor = cssVar('--color-gene-exon', '#4a7dc9');
  const intronColor = cssVar('--color-gene-intron', '#b8c8d8');

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
