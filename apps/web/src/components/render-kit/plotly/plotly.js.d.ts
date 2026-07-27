// plotly.js ships a UMD/CJS bundle with no first-party TypeScript types.
// Declare the engine surface we actually use so the rest of the codebase can
// import it with full type safety. Values are intentionally loose (`unknown`)
// because figure construction is governed by the local `PlotlyData` /
// `PlotlyLayout` types in `plotlyTypes.ts`.
//
// `plotly.js-dist-min` exposes the same runtime API, so reuse the same
// declarations here.
declare module 'plotly.js' {
  export function react(
    gd: unknown,
    data: unknown,
    layout?: unknown,
    config?: unknown,
  ): Promise<unknown>;

  export function newPlot(
    gd: unknown,
    data?: unknown,
    layout?: unknown,
    config?: unknown,
  ): Promise<unknown>;

  export function purge(gd: unknown): void;

  export const Plots: {
    resize(gd: unknown): Promise<unknown>;
  };

  const engine: {
    react: typeof react;
    newPlot: typeof newPlot;
    purge: typeof purge;
    Plots: typeof Plots;
  };

  export default engine;
}

declare module 'plotly.js-dist-min' {
  export function react(
    gd: unknown,
    data: unknown,
    layout?: unknown,
    config?: unknown,
  ): Promise<unknown>;

  export function newPlot(
    gd: unknown,
    data?: unknown,
    layout?: unknown,
    config?: unknown,
  ): Promise<unknown>;

  export function purge(gd: unknown): void;

  export const Plots: {
    resize(gd: unknown): Promise<unknown>;
  };

  const engine: {
    react: typeof react;
    newPlot: typeof newPlot;
    purge: typeof purge;
    Plots: typeof Plots;
  };

  export default engine;
}
