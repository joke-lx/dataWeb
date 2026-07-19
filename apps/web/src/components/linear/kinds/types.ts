import type { Viewport } from '../../../store/viewport';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  width: number;
  height: number;
  sampleId: string;
  trackName: string;
}
