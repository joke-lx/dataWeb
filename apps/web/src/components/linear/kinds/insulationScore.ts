import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export function renderInsulationScore(
  rc: RenderContext,
  records: Array<{
    chrom: string;
    start: number;
    end: number;
    score: number;
  }>,
): void {
  const { ctx, viewport, width, height } = rc;
  const rootStyle = getComputedStyle(document.documentElement);
  const cssA =
    rootStyle.getPropertyValue('--color-a-compartment').trim() || '#c0392b';
  const cssB =
    rootStyle.getPropertyValue('--color-b-compartment').trim() || '#2c5fa6';
  const cssTad =
    rootStyle.getPropertyValue('--color-tad-boundary').trim() || '#1a1a1a';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const midY = height / 2;
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();

  let maxAbs = 0.1;
  for (const record of records) {
    maxAbs = Math.max(maxAbs, Math.abs(record.score));
  }

  ctx.beginPath();
  ctx.moveTo(0, midY);
  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const centerX = (x1 + x2) / 2;
    const normalizedScore = record.score / maxAbs;
    const y = midY - normalizedScore * (height / 2 - 4);
    ctx.lineTo(centerX, y);
  }
  ctx.lineTo(width, midY);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, `${cssA}cc`);
  gradient.addColorStop(0.5, '#ffffff00');
  gradient.addColorStop(1, `${cssB}cc`);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  let first = true;
  for (const record of records) {
    if (record.chrom !== viewport.chr) continue;
    const x1 = bpToPx(record.start, viewport, width);
    const x2 = bpToPx(record.end, viewport, width);
    const centerX = (x1 + x2) / 2;
    const normalizedScore = record.score / maxAbs;
    const y = midY - normalizedScore * (height / 2 - 4);
    if (first) {
      ctx.moveTo(centerX, y);
      first = false;
    } else {
      ctx.lineTo(centerX, y);
    }
  }
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const chromosomeRecords = records.filter(
    (record) => record.chrom === viewport.chr,
  );
  for (let index = 1; index < chromosomeRecords.length - 1; index += 1) {
    const previousScore = chromosomeRecords[index - 1].score;
    const current = chromosomeRecords[index];
    const nextScore = chromosomeRecords[index + 1].score;
    if (
      current.score < previousScore &&
      current.score < nextScore &&
      current.score < 0
    ) {
      const x1 = bpToPx(current.start, viewport, width);
      const x2 = bpToPx(current.end, viewport, width);
      const centerX = (x1 + x2) / 2;
      ctx.strokeStyle = cssTad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, height - 6);
      ctx.lineTo(centerX, height - 1);
      ctx.stroke();
    }
  }
}
