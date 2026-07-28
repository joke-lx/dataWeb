/**
 * BigwigStacked —— 多样本 bigwig 的 Plotly 构建器。
 *
 * 这个文件**不是** React 组件（注意 `.ts` 后缀），只暴露：
 *  1. `BigwigSeries` 类型——"一个样本的 bigwig 切片"数据结构；
 *  2. `buildBigwigStacked` 函数——把 N 个 series 拼成一张共享 x 轴、各自 y 轴的 Plotly 图。
 *
 * 几何与 demo 对齐（`docx/refrences/demo/tracks_offline.html`）：
 *  - 每个样本一份水平切片（独立 y 轴），切片间 gap 固定 `0.012 * height`；
 *  - 第一片顶部 padding `0.055 * height`，最后一片贴齐底部 margin；
 *  - 右侧 (`xref:'paper' x=1.005`)：样本 id，色匹配；
 *  - 左侧 (`xref:'paper' x=-0.09`)：组名旋转 −90°，跨整组垂直居中；
 *  - 高亮 band (`xref:'x' yref:'paper'`) 跨整栈垂直范围。
 *
 * 与 `buildBigwigOverlay`（单 y 轴 + N trace）的差异：这是 demo 风格（多切片），
 * `<BigwigStackedLane />` 在 N≥2 时选它；N=1 退回到 `buildBigwig`。
 *
 * 架构位置：业务算法（非 UI）放在 tracks 模型目录里，与 `<BigwigStackedLane />`
 * 配套使用，不抽到 render-kit（因为它的 layout 语义和"tracks 演示"绑定）。
 */

import type { PlotlyBuild, PlotlyData, PlotlyLayout } from '../../render-kit/plotly/plotlyTypes';
import { baseLayout } from '../../render-kit/plotlyBuilders';
import type { Viewport } from '../../../store/viewport';

/**
 * 单样本 bigwig 序列：在 `buildBigwigStacked`（N 横向切片）和
 * 旧版 `buildBigwigOverlay`（N trace 共享 y 轴）里都会用到。
 */
export interface BigwigSeries {
  /** 样本 id，作为右侧 legend / 标注的 trace 名。 */
  id: string;
  values: Float32Array | undefined;
  line: string;
  fill: string;
}

/**
 * 多样本 bigwig 布局生成器：每个样本一个水平切片（独立 y 轴），
 * 共享一个基因组 x 轴。
 *
 * @param series 各样本的 bigwig series（顺序 = 显示顺序，从上到下）
 * @param viewport 当前视口（chr/start/end）
 * @param _title 故意不渲染——演示风格布局用左侧 group label + 右侧 sample label
 *               表达身份；保留参数是为了让 Lane 调用方不用按 lane kind 分叉。
 * @param height 图总高（像素）
 * @param groupLabel 左侧旋转组名
 * @param highlightBands 可选高亮区间（x 轴单位），跨整栈垂直范围
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
