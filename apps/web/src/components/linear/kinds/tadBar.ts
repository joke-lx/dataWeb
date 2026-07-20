import type { TadRecord } from '../../../api/types';
import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export type { TadRecord } from '../../../api/types';

export function renderTadBar(
  rc: RenderContext,
  records: TadRecord[],
): void {
  const { ctx, viewport, width, height } = rc;
  const rootStyle = getComputedStyle(document.documentElement);
  const cssTadBody =
    rootStyle.getPropertyValue('--color-tad-body').trim() || '#e8e8e8';
  const cssTadBoundary =
    rootStyle.getPropertyValue('--color-tad-boundary').trim() || '#1a1a1a';
  const cssTadLabel =
    rootStyle.getPropertyValue('--color-tad-label').trim() || '#3a3a3a';

  ctx.fillStyle = cssTadBody;
  ctx.fillRect(0, 0, width, height);

  // 12px grey body, leaves 3px top/bottom for boundary lines
  const bodyHeight = Math.min(12, height - 6);
  const bodyTop = (height - bodyHeight) / 2;
  const bodyBottom = bodyTop + bodyHeight;

  ctx.font = '10px sans-serif';
  ctx.textBaseline = 'middle';

  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    if (record.end < viewport.start || record.start > viewport.end) continue;
    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const barWidth = Math.max(1, x2 - x1);

    // Grey body fill
    ctx.fillStyle = cssTadBody;
    ctx.fillRect(x1, bodyTop, barWidth, bodyHeight);

    // Top boundary line (dark)
    ctx.fillStyle = cssTadBoundary;
    ctx.fillRect(x1, bodyTop - 1, barWidth, 1);
    // Bottom boundary line
    ctx.fillRect(x1, bodyBottom, barWidth, 1);

    // Subtle TAD score label inside body (if wide enough)
    if (barWidth > 60) {
      ctx.fillStyle = cssTadLabel;
      ctx.fillText(`TAD ${record.score.toFixed(2)}`, x1 + 4, bodyTop + bodyHeight / 2);
    }
  }
}