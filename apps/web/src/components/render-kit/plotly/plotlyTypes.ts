/**
 * 定义 render-kit 构建与驱动 Plotly 图形所需的最小结构类型，并封装运行时动态导入。
 * 宽松索引签名保留 Plotly 扩展能力，显式常用字段则为轨道构建器提供类型检查与自动补全。
 */
// Minimal structural types for the Plotly figures we build. Kept intentionally
// loose (with index signatures) so the builders do not depend on plotly.js's
// absent first-party type bundle, while still giving callers autocomplete for
// the fields we set.

/**
 * render-kit 会生成的 Plotly trace 最小结构。
 * 索引签名允许构建器按需使用 Plotly 的长尾字段，而无需把本地类型升级成完整第三方 schema。
 */
export interface PlotlyData {
  type?: string;
  mode?: string;
  x?: Array<number> | Array<string>;
  y?: Array<number>;
  fill?: string;
  fillcolor?: string;
  line?: { color?: string; width?: number; shape?: string; [key: string]: unknown };
  marker?: {
    color?: string | Array<string>;
    size?: number;
    symbol?: string;
    [key: string]: unknown;
  };
  text?: Array<string>;
  textposition?: string;
  textfont?: { size?: number; color?: string };
  showlegend?: boolean;
  hoverinfo?: string;
  [key: string]: unknown;
}

/** 描述轨道共享的 Plotly 画布布局，并允许透传尚未显式建模的布局选项。 */
export interface PlotlyLayout {
  title?: string | { text: string; font?: { size?: number; color?: string } };
  height?: number;
  width?: number;
  margin?: { t?: number; b?: number; l?: number; r?: number };
  xaxis?: { [key: string]: unknown };
  yaxis?: { [key: string]: unknown };
  shapes?: Array<{ [key: string]: unknown }>;
  hovermode?: boolean | string;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  font?: { size?: number; color?: string; family?: string };
  [key: string]: unknown;
}

/** 控制嵌入式 Plotly 引擎的交互与响应式行为。 */
export interface PlotlyConfig {
  staticPlot?: boolean;
  responsive?: boolean;
  displayModeBar?: boolean | string;
  [key: string]: unknown;
}

/** Plotly 引擎的最小命令式 API，用于更新、首次挂载、清理与尺寸同步。 */
export interface PlotlyApi {
  react: (
    gd: HTMLElement | string,
    data: PlotlyData[],
    layout: PlotlyLayout,
    config?: PlotlyConfig,
  ) => Promise<unknown>;
  newPlot: (
    gd: HTMLElement | string,
    data: PlotlyData[],
    layout?: PlotlyLayout,
    config?: PlotlyConfig,
  ) => Promise<unknown>;
  purge: (gd: HTMLElement | string) => void;
  Plots: { resize: (gd: HTMLElement | string) => Promise<unknown> };
}

/** 将构建器的 traces 与 layout 打包为 PlotlyTrack 可直接消费的不可变结果形状。 */
export interface PlotlyBuild {
  data: PlotlyData[];
  layout: PlotlyLayout;
}

/**
 * 延迟加载 Plotly，并消除 ESM/CJS 打包器在 `default` 包装上的差异。
 *
 * @returns 无论运行时模块形态如何都规范化为同一 `PlotlyApi` 的引擎对象。
 */
export async function loadPlotly(): Promise<PlotlyApi> {
  const mod = (await import('plotly.js-dist-min')) as unknown as {
    default?: PlotlyApi;
  } & Partial<PlotlyApi>;
  return (mod.default ?? (mod as unknown as PlotlyApi)) as PlotlyApi;
}
