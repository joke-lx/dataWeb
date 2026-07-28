/**
 * render-kit 的 Plotly 生命周期适配器，把声明式 React 属性桥接到按命令更新的 Plotly 引擎。
 * 该组件集中处理动态加载、容器缩放和资源释放，使业务轨道只需提供 figure 数据而不直接依赖 Plotly 运行时。
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import {
  loadPlotly,
  type PlotlyBuild,
  type PlotlyConfig,
  type PlotlyLayout,
} from './plotlyTypes';
import './plotly-track.css';

interface PlotlyTrackProps {
  /** Plotly trace 定义（纯形状轨道可为空）。 */
  data: PlotlyBuild['data'];
  /** Plotly 布局。`height` 由下面的 prop 注入。 */
  layout: Partial<PlotlyLayout>;
  /** Lane 像素高度。 */
  height: number;
}

// 轨道嵌在 d3-zoom 舞台中，因此必须禁用 Plotly 自身的指针交互；
// 否则 Plotly 会截获事件，导致外层基因组平移和缩放失效。
const PLOTLY_CONFIG: PlotlyConfig = {
  staticPlot: true,
  responsive: true,
  displayModeBar: false,
};

/**
 * 将 Plotly figure 挂载到 React 容器，并随属性和容器尺寸保持同步。
 *
 * @param props - trace 数据、布局片段及由 lane 决定的最终像素高度。
 * @returns 由 Plotly 接管内部内容的宿主元素。
 *
 * 动态导入把约 3 MB 的引擎留在懒加载 chunk；更新时使用 `react`，卸载时
 * 使用 `purge` 释放 Plotly 内部分配的 canvas/WebGL 资源。
 */
export function PlotlyTrack({
  data,
  layout,
  height,
}: PlotlyTrackProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;

    loadPlotly().then((Plotly) => {
      if (disposed || !el) return;
      void Plotly.react(el, data, { ...layout, height }, PLOTLY_CONFIG);
    });

    return () => {
      disposed = true;
      void loadPlotly().then((Plotly) => {
        try {
          Plotly.purge(el);
        } catch {
          /* 元素已被移除 */
        }
      });
    };
  }, [data, layout, height]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const observer = new ResizeObserver(() => {
      if (cancelled) return;
      void loadPlotly().then((Plotly) => {
        if (cancelled || !el) return;
        try {
          void Plotly.Plots.resize(el);
        } catch {
          /* 不做处理 */
        }
      });
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="plotly-track"
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
