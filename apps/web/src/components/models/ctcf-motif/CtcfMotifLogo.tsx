import { useMemo } from 'react';
import type { JSX } from 'react';

import './tracks.css';

/** Render a 4×N log-odds PWM as an SVG sequence logo. */
export interface CtcfMotifLogoProps {
  matrix: number[][];
  consensus: string;
  width?: number;
  height?: number;
}

const BASE_COLORS: Record<string, string> = {
  A: '#2e7d32', // green
  C: '#1565c0', // blue
  G: '#f9a825', // amber
  T: '#e53935', // red
};

const BASE_ORDER = ['A', 'C', 'G', 'T'];

export function CtcfMotifLogo({
  matrix,
  consensus,
  width = 800,
  height = 180,
}: CtcfMotifLogoProps): JSX.Element {
  const nCols = matrix.length > 0 ? matrix[0].length : 0;

  const stacks = useMemo(() => {
    // Convert log-odds to probability-like stack heights per column.
    // Each column: translate log2(p/0.25) back to probability proportions,
    // then scale to a fixed total height of 1.0 info-content is not
    // computed — we just show relative proportions for visual clarity.
    const result: { base: string; y: number; h: number; color: string }[][] = [];
    for (let col = 0; col < nCols; col++) {
      const entries: { base: string; val: number }[] = [];
      for (let row = 0; row < 4; row++) {
        const logOdds = matrix[row]?.[col] ?? 0;
        // p = 0.25 * 2^logOdds, clipped to [0, 1]
        const p = Math.min(1, Math.max(0, 0.25 * Math.pow(2, logOdds)));
        entries.push({ base: BASE_ORDER[row], val: p });
      }
      const total = entries.reduce((s, e) => s + e.val, 0);
      const normalized = total > 0
        ? entries.map((e) => ({ ...e, val: e.val / total }))
        : entries.map((e) => ({ ...e, val: 0.25 }));

      // Sort from tallest to shortest for stacking
      normalized.sort((a, b) => b.val - a.val);

      let yAccum = 0;
      const colStacks: { base: string; y: number; h: number; color: string }[] = [];
      for (const e of normalized) {
        const h = e.val * (height - 40); // scale to SVG height
        colStacks.push({
          base: e.base,
          y: yAccum,
          h: Math.max(h, 1), // at least 1px visible
          color: BASE_COLORS[e.base] ?? '#999',
        });
        yAccum += h;
      }
      result.push(colStacks);
    }
    return result;
  }, [matrix, nCols, height]);

  if (nCols === 0) return <div className="ctcf-motif-panel"><p>No motif data</p></div>;

  const colW = Math.max(12, Math.min(30, (width - 40) / nCols));
  const padX = 20;
  const svgW = padX * 2 + nCols * colW + (nCols - 1) * 1;

  return (
    <div className="ctcf-motif-panel">
      <h3>CTCF Motif Logo</h3>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Consensus: <code style={{ fontFamily: 'var(--font-mono)', letterSpacing: 2 }}>{consensus}</code>
      </p>
      <svg className="motif-logo-svg" viewBox={`0 0 ${svgW} ${height}`} preserveAspectRatio="xMidYMid meet">
        {stacks.map((colStacks, colIdx) =>
          colStacks.map((stack) => (
            <rect
              key={`${colIdx}-${stack.base}`}
              x={padX + colIdx * (colW + 1)}
              y={height - 40 - stack.y - stack.h}
              width={colW}
              height={stack.h}
              fill={stack.color}
              opacity={0.85}
            >
              <title>{stack.base}: {stack.h.toFixed(1)}px</title>
            </rect>
          )),
        )}
        {/* Consensus letter labels */}
        {consensus.split('').map((base, i) => (
          <text
            key={i}
            x={padX + i * (colW + 1) + colW / 2}
            y={height - 24}
            textAnchor="middle"
            fill={BASE_COLORS[base] ?? '#999'}
            fontSize={Math.max(8, colW * 0.7)}
            fontWeight={600}
          >
            {base}
          </text>
        ))}
      </svg>
    </div>
  );
}
