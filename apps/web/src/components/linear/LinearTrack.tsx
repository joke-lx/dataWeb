import { useCallback, useEffect, useRef, useState } from 'react';

import { pxToBp } from '../../genomics/coords';
import { useCursor, type CursorTrack } from '../../store/cursor';
import { useViewport } from '../../store/viewport';
import { renderBedGraph } from './kinds/bedGraph';
import { renderBigwig } from './kinds/bigwig';
import { renderGene } from './kinds/gene';
import { renderInsulationScore } from './kinds/insulationScore';
import { renderPei } from './kinds/pei';
import { renderSV } from './kinds/sv';
import { renderTadBar } from './kinds/tadBar';
import type { RenderContext } from './kinds/types';
import './linear-track.css';

export type LinearKind =
  | 'bigwig'
  | 'bedGraph'
  | 'tadBar'
  | 'pei'
  | 'gene'
  | 'is'
  | 'sv';

const CURSOR_TRACKS: Record<LinearKind, CursorTrack> = {
  bigwig: 'bigwig',
  bedGraph: 'ab',
  tadBar: 'tad',
  pei: 'pei',
  gene: 'gene',
  is: 'is',
  sv: 'sv',
};

interface LinearTrackProps {
  kind: LinearKind;
  sampleId: string;
  trackName: string;
  data: unknown;
  loading?: boolean;
  error?: Error | null;
  vmin?: number;
  vmax?: number;
  height: number;
  mirror?: boolean;
}

export function LinearTrack({
  kind,
  sampleId,
  trackName,
  data,
  loading,
  error,
  vmin = 0,
  vmax = 1,
  height,
  mirror = false,
}: LinearTrackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const viewport = useViewport();

  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, height);
    ctx.globalAlpha = 1;

    if (!data) {
      setRenderError(null);
      return;
    }

    const renderContext: RenderContext = {
      ctx,
      viewport,
      width: rect.width,
      height,
      sampleId,
      trackName,
    };

    try {
      switch (kind) {
        case 'bigwig':
          renderBigwig(renderContext, data as Float32Array, vmin, vmax, mirror);
          break;
        case 'bedGraph':
          renderBedGraph(
            renderContext,
            data as Parameters<typeof renderBedGraph>[1],
          );
          break;
        case 'tadBar':
          renderTadBar(
            renderContext,
            data as Parameters<typeof renderTadBar>[1],
          );
          break;
        case 'pei':
          renderPei(renderContext, data as Parameters<typeof renderPei>[1]);
          break;
        case 'gene':
          renderGene(renderContext, data as Parameters<typeof renderGene>[1]);
          break;
        case 'is':
          renderInsulationScore(
            renderContext,
            data as Parameters<typeof renderInsulationScore>[1],
          );
          break;
        case 'sv':
          renderSV(renderContext, data as Parameters<typeof renderSV>[1]);
          break;
      }
      setRenderError(null);
    } catch (caught) {
      setRenderError(
        caught instanceof Error ? caught : new Error(String(caught)),
      );
    } finally {
      ctx.globalAlpha = 1;
    }
  }, [kind, data, viewport, height, vmin, vmax, sampleId, trackName, mirror]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  const displayedError = error ?? renderError;

  return (
    <div
      className="linear-track"
      ref={containerRef}
      style={{ height: `${height}px` }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const localX = event.clientX - rect.left;
        const stageContent = event.currentTarget.closest('.stage-content');
        const stageRect = stageContent?.getBoundingClientRect();
        const stageX = event.clientX - (stageRect?.left ?? rect.left);
        const bp = pxToBp(localX, viewport, rect.width);
        useCursor.getState().setCursor(stageX, bp, CURSOR_TRACKS[kind]);
      }}
      onMouseLeave={() => useCursor.getState().setCursor(null, null, null)}
    >
      <canvas ref={canvasRef} />
      {loading && <span className="track-loading">…</span>}
      {displayedError && (
        <span className="track-error" title={displayedError.message}>
          !
        </span>
      )}
    </div>
  );
}
