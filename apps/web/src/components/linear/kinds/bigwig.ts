import type { RenderContext } from './types';

export function renderBigwig(
  rc: RenderContext,
  values: Float32Array,
  vmin: number,
  vmax: number,
): void {
  const { ctx, width, height } = rc;
  const n = values.length;
  if (n === 0) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const cssAccent =
    rootStyle.getPropertyValue('--sample-a').trim() || '#c0392b';
  const cssBg =
    rootStyle.getPropertyValue('--color-surface-2').trim() || '#f0f0f0';

  ctx.fillStyle = cssBg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.fillStyle = cssAccent;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i < n; i += 1) {
    const t = (values[i] - vmin) / (vmax - vmin + 1e-9);
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const y = height - Math.max(0, Math.min(1, t)) * (height - 4) - 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
}
