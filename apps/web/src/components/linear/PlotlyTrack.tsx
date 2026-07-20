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
  /** Plotly trace definitions (may be empty for shape-only tracks). */
  data: PlotlyBuild['data'];
  /** Plotly layout. `height` is injected from the prop below. */
  layout: Partial<PlotlyLayout>;
  /** Lane height in pixels. */
  height: number;
}

// Tracks are embedded inside a d3-zoom stage. Keep them fully static so Plotly
// attaches no pointer listeners (which would otherwise hijack stage pan/zoom)
// while still rendering anti-aliased geometry, grid, ticks and titles.
const PLOTLY_CONFIG: PlotlyConfig = {
  staticPlot: true,
  responsive: true,
  displayModeBar: false,
};

/**
 * Mounts a Plotly figure into a div and keeps it in sync with `data`/`layout`.
 *
 * - Uses a dynamic import so plotly.js (~3 MB) lands in a lazy chunk and never
 *   blocks the initial app bundle.
 * - `Plotly.react` on every prop change; `Plotly.purge` on unmount to release
 *   the WebGL/canvas resources Plotly allocates internally.
 * - A `ResizeObserver` calls `Plotly.Plots.resize` so the figure tracks its
 *   flex container width (e.g. when the left rail collapses).
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
          /* element already removed */
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
          /* noop */
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
