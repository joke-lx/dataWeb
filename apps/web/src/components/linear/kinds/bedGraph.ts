import type { BedGraphRecord } from '../../../api/types';
import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export type { BedGraphRecord } from '../../../api/types';

export function renderBedGraph(
  rc: RenderContext,
  records: BedGraphRecord[],
): void {
  const { ctx, viewport, width, height } = rc;
  const rootStyle = getComputedStyle(document.documentElement);
  const cssA =
    rootStyle.getPropertyValue('--color-a-compartment').trim() || '#c0392b';
  const cssB =
    rootStyle.getPropertyValue('--color-b-compartment').trim() || '#2c5fa6';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const midY = height / 2;
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  let maxAbs = 0.1;
  for (const record of records) {
    maxAbs = Math.max(maxAbs, Math.abs(record.score));
  }

  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    if (record.end < viewport.start || record.start > viewport.end) continue;
    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const barWidth = Math.max(1, x2 - x1);
    const t = record.score / maxAbs;
    const barHeight = Math.abs(t) * (height / 2 - 2);
    const y = t >= 0 ? midY - barHeight : midY;
    ctx.fillStyle = t >= 0 ? cssA : cssB;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x1, y, barWidth, barHeight);
  }
  ctx.globalAlpha = 1;
}
