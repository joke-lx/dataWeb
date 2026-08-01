/**
 * 将基因组领域数据转换为 Plotly figure 的通用算法层，供多个业务模型共享一致的坐标、配色和轨道布局。
 * 本文件不发起查询也不持有 React 状态；它存在于 render-kit，是为了让模型组件只处理数据来源而不重复图形构造规则。
 */
import type { BedGraphRecord, GeneRecord, PeiRecord, TadRecord } from '../../api/types';
import type { SVRecord } from '../../api/client';
import type { Viewport } from '../../store/viewport';
import type { PlotlyBuild, PlotlyData, PlotlyLayout } from './plotly/plotlyTypes';

/** 从 :root 读取 CSS 自定义属性，未设置/为空时回退。 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** 给 #rrggbb 颜色追加 alpha 通道（返回 rgba() 更安全）。 */
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
 * 构造所有线性基因组轨道共享的 Plotly 布局骨架。
 *
 * @param viewport - 决定统一基因组 x 轴范围的当前视口。
 * @param title - 轨道内显示的紧凑标题。
 * @param height - Plotly 画布的像素高度。
 * @param opts - 轴、形状与边距覆盖项，用于保留不同轨道的表达需求。
 * @returns 具有透明背景和统一轴样式的布局对象。
 */
export function baseLayout(
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

/**
 * 将等距采样的连续信号构造成正向面积轨道。
 *
 * @param values - 覆盖视口的等距信号值；缺失时生成空轨道。
 * @param viewport - 用于把数组索引还原为基因组坐标的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 可直接交给 PlotlyTrack 的 trace 与布局。
 */
export function buildBigwig(
  values: Float32Array | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const color = cssVar('--sample-a', '#9d2c44');
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
 * 将有符号 bedGraph 信号拆成 A/B compartment 填充，并叠加连续轮廓线。
 *
 * @param records - 可能包含多条染色体的 bedGraph 记录。
 * @param viewport - 提供目标染色体与统一 x 轴范围。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 零线上下分色的 Plotly figure。
 */
export function buildBedGraph(
  records: BedGraphRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const colorA = cssVar('--color-a-compartment', '#9d2c44');
  const colorB = cssVar('--color-b-compartment', '#2e7d4e');
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

/**
 * 构造带零值参考线的 insulation score 平滑信号轨道。
 *
 * @param records - 可能包含多条染色体的 insulation 记录。
 * @param viewport - 决定筛选染色体和可见范围的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 带轻量面积填充的 Plotly figure。
 */
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

/**
 * 把 TAD 区间映射为占满轨道高度的 domain 矩形。
 *
 * @param records - TAD 边界记录。
 * @param viewport - 用于筛选染色体并对齐横轴的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 以 layout shapes 表达、无需 trace 的 Plotly figure。
 */
export function buildTadBar(
  records: TadRecord[] | undefined,
  viewport: Viewport,
  title: string,
  height: number,
): PlotlyBuild {
  const body = cssVar('--color-tad-body', '#f7f8f8');
  const boundary = cssVar('--color-tad-boundary', '#1f2c2a');
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

/**
 * 把成对锚点区间构造成跨越 lane 的二次曲线弧。
 *
 * @param records - promoter-enhancer interaction 区间。
 * @param viewport - 用于保留与当前窗口相交记录的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 以 SVG path shapes 表达的 Plotly figure。
 */
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

/**
 * 将结构变异放置为按类别着色且带标签的区间中心标记。
 *
 * @param records - DEL、DUP、INV 或 TRA 记录。
 * @param viewport - 用于裁剪不可见变异并统一横轴的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 使用单一 marker trace 的 Plotly figure。
 */
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

/**
 * 聚合同一基因的片段，并生成错行排列的内含子骨架与外显子矩形。
 *
 * @param records - 按片段提供的基因注释记录。
 * @param viewport - 用于筛选染色体并对齐横轴的视口。
 * @param title - 轨道标题。
 * @param height - 图形像素高度。
 * @returns 以 layout shapes 表达的四行基因模型 figure。
 */
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
  // 输入通常是一行一个片段；先按 gene_name 合并，才能画出一条完整内含子骨架，
  // 同时仍保留每个 exon 的独立边界。
  for (const r of records ?? []) {
    if (r.chrom !== viewport.chr) continue;
    const existing = byGene.get(r.gene_name);
    const gene: GeneAccum = existing ?? {
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
  // 固定少量视觉行并循环分配，优先保持 lane 高度稳定；密集区域允许横向重叠，
  // 而不是让模型数量驱动页面高度无限增长。
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
