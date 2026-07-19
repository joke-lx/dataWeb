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
    rootStyle.getPropertyValue('--color-tad-body').trim() || '#f5f5f5';
  const cssTadBoundary =
    rootStyle.getPropertyValue('--color-tad-boundary').trim() || '#1a1a1a';

  ctx.fillStyle = cssTadBody;
  ctx.fillRect(0, 0, width, height);

  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    if (record.end < viewport.start || record.start > viewport.end) continue;
    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const barWidth = Math.max(1, x2 - x1);
    ctx.fillStyle = cssTadBoundary;
    ctx.fillRect(x1, 0, barWidth, 3);
    ctx.fillRect(x1, height - 3, barWidth, 3);
  }
}
