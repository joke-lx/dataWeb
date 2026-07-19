import type { PeiRecord } from '../../../api/types';
import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export type { PeiRecord } from '../../../api/types';

export function renderPei(rc: RenderContext, records: PeiRecord[]): void {
  const { ctx, viewport, width, height } = rc;
  const cssPei =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-pei-anchor')
      .trim() || '#d4a017';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e5e5e5';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  let maxScore = 0.1;
  for (const record of records) {
    maxScore = Math.max(maxScore, record.score);
  }

  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    if (record.start < viewport.start || record.start > viewport.end) continue;
    const x = bpToPx(record.start, viewport, width);
    const t = record.score / maxScore;
    const radius = 2 + t * 5;
    const y = height / 2;
    ctx.fillStyle = cssPei;
    ctx.globalAlpha = 0.5 + 0.5 * t;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
