import type { SVRecord } from '../../../api/client';
import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export type { SVRecord } from '../../../api/client';

export function renderSV(rc: RenderContext, records: SVRecord[]): void {
  const { ctx, viewport, width, height } = rc;

  const cssDel =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-sv-del')
      .trim() || '#b5305d';
  const cssDup =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-sv-dup')
      .trim() || '#2e8b57';
  const cssInv =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-sv-inv')
      .trim() || '#6e4ca0';
  const cssTra =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--color-sv-tra')
      .trim() || '#444444';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    if (record.end < viewport.start || record.start > viewport.end) continue;

    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const centerX = (x1 + x2) / 2;
    const glyphWidth = Math.max(4, x2 - x1);
    const midY = height / 2;
    const color =
      record.kind === 'DEL'
        ? cssDel
        : record.kind === 'DUP'
          ? cssDup
          : record.kind === 'INV'
            ? cssInv
            : cssTra;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (record.kind === 'DEL') {
      ctx.beginPath();
      ctx.moveTo(centerX, midY + 8);
      ctx.lineTo(centerX - glyphWidth / 2, midY - 8);
      ctx.lineTo(centerX + glyphWidth / 2, midY - 8);
      ctx.closePath();
      ctx.fill();
    } else if (record.kind === 'DUP') {
      ctx.beginPath();
      ctx.moveTo(centerX, midY - 8);
      ctx.lineTo(centerX - glyphWidth / 2, midY + 8);
      ctx.lineTo(centerX + glyphWidth / 2, midY + 8);
      ctx.closePath();
      ctx.fill();
    } else if (record.kind === 'INV') {
      ctx.fillRect(
        centerX - glyphWidth / 2,
        midY - 6,
        glyphWidth / 2 - 1,
        4,
      );
      ctx.fillRect(centerX + 1, midY + 2, glyphWidth / 2 - 1, 4);
      ctx.beginPath();
      ctx.moveTo(centerX + glyphWidth / 2 - 4, midY - 4);
      ctx.lineTo(centerX + glyphWidth / 2, midY - 4);
      ctx.lineTo(centerX + glyphWidth / 2 - 2, midY - 7);
      ctx.fill();
    } else {
      ctx.fillRect(
        centerX - glyphWidth / 2,
        midY - 8,
        Math.max(1, glyphWidth / 2 - 2),
        3,
      );
      ctx.fillRect(
        centerX + 2,
        midY + 5,
        Math.max(1, glyphWidth / 2 - 2),
        3,
      );
    }

    if (glyphWidth > 30) {
      ctx.fillStyle = '#333';
      ctx.font = '10px monospace';
      ctx.fillText(record.kind, centerX + 6, midY + 3);
    }
  }
}
