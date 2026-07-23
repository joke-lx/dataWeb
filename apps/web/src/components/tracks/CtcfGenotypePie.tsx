import type { JSX } from 'react';

import type { CtcfGenotypeRecord } from '../../api/types';
import './tracks.css';

export interface CtcfGenotypePieProps {
  records: CtcfGenotypeRecord[];
}

const PIE_COLORS: Record<string, string> = {
  ref_hom: '#4caf50',
  het: '#ff9800',
  alt_hom: '#f44336',
};

const LABELS: Record<string, string> = {
  ref_hom: 'Ref hom',
  het: 'Het',
  alt_hom: 'Alt hom',
};

function polarToCartesian(
  cx: number, cy: number, r: number, angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

function PieChart({
  data,
  cx, cy, r,
}: {
  data: { key: string; value: number }[];
  cx: number; cy: number; r: number;
}): JSX.Element {
  const total = data.reduce((s, d) => s + d.value, 0);
  let current = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const startAngle = (current / total) * 360;
      current += d.value;
      const endAngle = (current / total) * 360;
      return {
        key: d.key,
        path: describeArc(cx, cy, r, startAngle, endAngle),
        color: PIE_COLORS[d.key] ?? '#999',
      };
    });

  return (
    <svg className="genotype-pie-svg" viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      {slices.map((s) => (
        <path key={s.key} d={s.path} fill={s.color} stroke="#fff" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function CtcfGenotypePie({ records }: CtcfGenotypePieProps): JSX.Element {
  // Show the first record's distribution; alternative: show all 3 SNPS as
  // small multiples. For now, show the first plus a list for the rest.
  const main = records[0];

  if (!main) {
    return (
      <div className="ctcf-motif-panel">
        <h3>Genotype Distribution</h3>
        <p>No genotype data</p>
      </div>
    );
  }

  const data = [
    { key: 'ref_hom', value: main.distribution.ref_hom },
    { key: 'het', value: main.distribution.het },
    { key: 'alt_hom', value: main.distribution.alt_hom },
  ];

  return (
    <div className="ctcf-motif-panel">
      <h3>Genotype Distribution</h3>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {main.snp_id} · {main.ref_allele}→{main.alt_allele}
      </p>
      <div className="genotype-pie-container">
        <PieChart data={data} cx={100} cy={100} r={80} />
        <div className="genotype-legend">
          {data.map((d) => (
            <span key={d.key} className="genotype-legend-item">
              <span
                className="genotype-legend-swatch"
                style={{ background: PIE_COLORS[d.key] ?? '#999' }}
              />
              {LABELS[d.key] ?? d.key}: {(d.value * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
