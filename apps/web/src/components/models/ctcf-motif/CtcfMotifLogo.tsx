/**
 * CtcfMotifLogo — CTCF motif 的 sequence logo SVG 渲染。
 *
 * 架构位置：
 * - models/ctcf-motif/ 私有组件：不依赖外部 d3/recharts，纯 SVG 自渲染（与 CtcfGenotypePie 同策略）
 * - 不放在 render-kit：因为 motif logo 是 CTCF 模型专属的可视化，不被其他 viewer 复用
 *
 * 职责：
 * - 把后端给的 4×N log-odds PWM 转成 SVG 矩形堆叠（"字母高度 ≈ 该位置信息量"）
 * - 在底部叠加 consensus 字母作为概览
 *
 * 关键算法：
 * - log-odds → 概率：p = 0.25 * 2^logOdds（log-odds 的反变换），clip 到 [0,1]
 * - 列内归一化：每列四个 base 的概率归一化到总和=1，再乘以可用高度得到像素高度
 * - 大→小排序后再堆叠，保证视觉上"大字母在下、小字母在上"，符合 sequence logo 习惯
 *
 * 信息量说明（注释中已标）：
 * - 这里没有显式计算 R = 2 - H（信息含量），只显示相对比例；后续如果要加可读性更佳
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import './tracks.css';

/** 把 4×N log-odds PWM 渲染为 SVG sequence logo。 */
export interface CtcfMotifLogoProps {
  /** PWM 矩阵：matrix[baseIndex][colIndex] = log2(p/0.25) */
  matrix: number[][];
  /** 后端算好的 consensus 字符串，用于底部字母标签 */
  consensus: string;
  /** SVG 宽度（像素） */
  width?: number;
  /** SVG 高度（像素） */
  height?: number;
}

// 与 BASE_ORDER 一一对应；颜色沿用经典 Clustal/序列 logo 配色（绿/蓝/琥珀/红）
const BASE_COLORS: Record<string, string> = {
  A: '#2e7d32', // green
  C: '#1565c0', // blue
  G: '#f9a825', // amber
  T: '#e53935', // red
};

// 与 matrix 的行索引严格一致：A=0, C=1, G=2, T=3；改顺序会导致颜色错位
const BASE_ORDER = ['A', 'C', 'G', 'T'];

/**
 * 渲染 sequence logo。
 * 性能上 useMemo 只在 matrix / 高度变化时重算列布局；窗口缩放不重算。
 */
export function CtcfMotifLogo({
  matrix,
  consensus,
  width = 800,
  height = 180,
}: CtcfMotifLogoProps): JSX.Element {
  // 容错：matrix 为空时直接走空态，避免后续 length=0 触发除零
  const nCols = matrix.length > 0 ? matrix[0].length : 0;

  const stacks = useMemo(() => {
    // 把 log-odds 转回"类似概率"的堆叠高度：
    //   每列：先按 log2(p/0.25) 反算 p，clip 到 [0,1]，再做列内归一化（合计=1）
    // 注意这里没有显式计算 information content (R = 2 - H)，
    // 只展示相对比例——视觉清晰优先
    const result: { base: string; y: number; h: number; color: string }[][] = [];
    for (let col = 0; col < nCols; col++) {
      const entries: { base: string; val: number }[] = [];
      for (let row = 0; row < 4; row++) {
        const logOdds = matrix[row]?.[col] ?? 0;
        // log-odds 反变换：p = 0.25 * 2^logOdds；clip 到 [0,1] 避免数值溢出或负值
        const p = Math.min(1, Math.max(0, 0.25 * Math.pow(2, logOdds)));
        entries.push({ base: BASE_ORDER[row], val: p });
      }
      const total = entries.reduce((s, e) => s + e.val, 0);
      // 全 0 列：兜底均匀分布，避免 NaN；这种列实际不会出现（数据流已被后端过滤）
      const normalized = total > 0
        ? entries.map((e) => ({ ...e, val: e.val / total }))
        : entries.map((e) => ({ ...e, val: 0.25 }));

      // 从大到小排序后再堆叠：让"最有信息量的字母"落在该列底部，符合标准 sequence logo 视觉
      normalized.sort((a, b) => b.val - a.val);

      let yAccum = 0;
      const colStacks: { base: string; y: number; h: number; color: string }[] = [];
      for (const e of normalized) {
        // (height - 40) 留出底部 40px 放 consensus 字母
        const h = e.val * (height - 40); // scale to SVG height
        colStacks.push({
          base: e.base,
          y: yAccum,
          // 最小 1px：避免极小概率（如 0）退化成 0 高度矩形（不可见也不可悬停）
          h: Math.max(h, 1), // at least 1px visible
          color: BASE_COLORS[e.base] ?? '#999',
        });
        yAccum += h;
      }
      result.push(colStacks);
    }
    return result;
  }, [matrix, nCols, height]);

  // 空数据兜底：与"success 后又被 loading 覆盖"的 UX 一致性
  if (nCols === 0) return <div className="ctcf-motif-panel"><p>No motif data</p></div>;

  // 自适应列宽：在 [12, 30] 区间内等分可用宽度
  const colW = Math.max(12, Math.min(30, (width - 40) / nCols));
  const padX = 20;
  // +1px 是列间距；最后列后无间距所以减 1
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
            // y 从底向上算：SVG y=0 在顶部，所以从 (height - 40) 开始往上扣 stack.y + stack.h
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
        {/* Consensus 字母标签：贴在堆叠下方 24px 处，居中对齐列中线 */}
        {consensus.split('').map((base, i) => (
          <text
            key={i}
            x={padX + i * (colW + 1) + colW / 2}
            y={height - 24}
            textAnchor="middle"
            fill={BASE_COLORS[base] ?? '#999'}
            // 字号跟列宽联动，避免太窄的列上文字溢出
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
