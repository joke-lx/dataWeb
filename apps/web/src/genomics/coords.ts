import type { Viewport } from '../store/viewport';

export function bpToPx(
  bp: number,
  viewport: Viewport,
  widthPx: number,
): number {
  return (
    ((bp - viewport.start) / (viewport.end - viewport.start)) * widthPx
  );
}

export function pxToBp(
  px: number,
  viewport: Viewport,
  widthPx: number,
): number {
  return (
    viewport.start +
    (px / widthPx) * (viewport.end - viewport.start)
  );
}

export function formatBp(bp: number): string {
  if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(2)} Mb`;
  if (bp >= 1_000) return `${(bp / 1_000).toFixed(1)} kb`;
  return `${bp} bp`;
}
