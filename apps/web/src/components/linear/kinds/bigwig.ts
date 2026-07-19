import type { RenderContext } from './types';

/**
 * Render a bigwig signal track.
 *
 * Normal mode (`mirror = false`): baseline at the bottom, peaks rise upward.
 * Mirrored mode (`mirror = true`): baseline at the top, peaks descend downward.
 * Mirrored mode is used for sample B in comparison view so the two signals
 * visually diverge from a shared mid-line. The mirrored fill uses the
 * `--sample-b` token (blue) to distinguish it from sample A (`--sample-a`, red).
 */
export function renderBigwig(
  rc: RenderContext,
  values: Float32Array,
  vmin: number,
  vmax: number,
  mirror: boolean = false,
): void {
  const { ctx, width, height } = rc;
  const n = values.length;
  if (n === 0) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const cssAccent = mirror
    ? rootStyle.getPropertyValue('--sample-b').trim() || '#2c5fa6'
    : rootStyle.getPropertyValue('--sample-a').trim() || '#c0392b';
  const cssBg =
    rootStyle.getPropertyValue('--color-surface-2').trim() || '#f0f0f0';

  ctx.fillStyle = cssBg;
  ctx.fillRect(0, 0, width, height);

  // Mid reference line — shared axis between sample A (above) and B (below)
  // when the two lanes are stacked in comparison mode.
  ctx.strokeStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  const baselineY = mirror ? 0 : height;

  ctx.fillStyle = cssAccent;
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  for (let i = 0; i < n; i += 1) {
    const t = (values[i] - vmin) / (vmax - vmin + 1e-9);
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const clamped = Math.max(0, Math.min(1, t));
    const y = mirror
      ? clamped * (height - 4) + 2
      : height - clamped * (height - 4) - 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, baselineY);
  ctx.closePath();
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
}
