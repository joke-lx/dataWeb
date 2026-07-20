// Minimal structural types for the Plotly figures we build. Kept intentionally
// loose (with index signatures) so the builders do not depend on plotly.js's
// absent first-party type bundle, while still giving callers autocomplete for
// the fields we set.

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

export interface PlotlyConfig {
  staticPlot?: boolean;
  responsive?: boolean;
  displayModeBar?: boolean | string;
  [key: string]: unknown;
}

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

export interface PlotlyBuild {
  data: PlotlyData[];
  layout: PlotlyLayout;
}

// Resolve the dynamic import and unwrap the bundler interop (`default`) so
// callers always receive the engine object regardless of how plotly.js is
// exposed at runtime.
export async function loadPlotly(): Promise<PlotlyApi> {
  const mod = (await import('plotly.js')) as unknown as {
    default?: PlotlyApi;
  } & Partial<PlotlyApi>;
  return (mod.default ?? (mod as unknown as PlotlyApi)) as PlotlyApi;
}
