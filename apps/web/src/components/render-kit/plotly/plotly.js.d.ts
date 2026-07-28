/**
 * 为缺少项目可用一方类型的 Plotly UMD/CJS 包补充最小 ambient module 声明。
 * 声明面只覆盖 render-kit 实际调用的生命周期 API；figure 的结构约束由本地 plotlyTypes.ts 承担，避免绑定庞大的第三方类型面。
 */
// plotly.js ships a UMD/CJS bundle with no first-party TypeScript types.
// Declare the engine surface we actually use so the rest of the codebase can
// import it with full type safety. Values are intentionally loose (`unknown`)
// because figure construction is governed by the local `PlotlyData` /
// `PlotlyLayout` types in `plotlyTypes.ts`.
//
// `plotly.js-dist-min` exposes the same runtime API, so reuse the same
// declarations here.
/**
 * 描述源码包 `plotly.js` 的最小运行时表面，兼容直接引用源码包的消费者。
 * `unknown` 是有意的边界：ambient 声明只保证引擎方法存在，不重复维护 figure schema。
 */
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

/**
 * 描述生产构建使用的压缩分发包；它与源码包共享同一运行时 API，
 * 但需要独立 ambient module 才能让 TypeScript 解析实际的动态导入路径。
 */
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
