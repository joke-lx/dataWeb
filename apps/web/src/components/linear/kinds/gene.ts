import type { GeneRecord } from '../../../api/types';
import { bpToPx } from '../../../genomics/coords';
import type { RenderContext } from './types';

export type { GeneRecord } from '../../../api/types';

export function renderGene(rc: RenderContext, records: GeneRecord[]): void {
  const { ctx, viewport, width, height } = rc;
  const rootStyle = getComputedStyle(document.documentElement);
  const cssExon =
    rootStyle.getPropertyValue('--color-gene-exon').trim() || '#4a7dc9';
  const cssIntron =
    rootStyle.getPropertyValue('--color-gene-intron').trim() || '#b8c8d8';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const byGene = new Map<string, GeneRecord[]>();
  for (const record of records) {
    const geneRecords = byGene.get(record.gene_name) ?? [];
    geneRecords.push(record);
    byGene.set(record.gene_name, geneRecords);
  }

  const geneHeight = 18;
  const gap = 4;
  const usableHeight = height - 4;
  const maxGenes = Math.max(
    1,
    Math.floor(usableHeight / (geneHeight + gap)),
  );

  let index = 0;
  for (const [geneName, geneRecords] of byGene) {
    if (index >= maxGenes) break;
    const yMid = 2 + index * (geneHeight + gap) + geneHeight / 2;
    index += 1;

    const exons = [...geneRecords].sort((a, b) => a.start - b.start);

    ctx.strokeStyle = cssIntron;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let firstX: number | null = null;
    let lastX: number | null = null;
    for (const exon of exons) {
      if (exon.chrom !== viewport.chr) continue;
      const x1 = Math.max(0, bpToPx(exon.start, viewport, width));
      const x2 = Math.min(width, bpToPx(exon.end, viewport, width));
      if (firstX === null) firstX = x1;
      lastX = x2;
    }

    if (firstX === null || lastX === null) continue;

    ctx.moveTo(firstX, yMid);
    ctx.lineTo(lastX, yMid);
    ctx.stroke();

    const strand = exons[0]?.strand ?? '+';
    const arrowX = strand === '+' ? lastX : firstX;
    const direction = strand === '+' ? 1 : -1;
    ctx.fillStyle = cssIntron;
    ctx.beginPath();
    ctx.moveTo(arrowX, yMid);
    ctx.lineTo(arrowX - direction * 6, yMid - 3);
    ctx.lineTo(arrowX - direction * 6, yMid + 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = cssExon;
    for (const exon of exons) {
      if (exon.chrom !== viewport.chr || !exon.is_exon) continue;
      const x1 = bpToPx(exon.start, viewport, width);
      const x2 = bpToPx(exon.end, viewport, width);
      const exonWidth = Math.max(2, x2 - x1);
      const exonHeight = 10;
      ctx.fillRect(x1, yMid - exonHeight / 2, exonWidth, exonHeight);
    }

    if (lastX - firstX > 80) {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '11px sans-serif';
      ctx.fillText(geneName, (firstX + lastX) / 2 - 20, yMid - 10);
    }
  }
}
