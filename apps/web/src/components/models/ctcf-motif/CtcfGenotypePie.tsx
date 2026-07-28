/**
 * CtcfGenotypePie — CTCF SNP 基因型分布饼图。
 *
 * 架构位置：
 * - models/ctcf-motif/ 私有组件（无 i18n 字符串硬编码——未来如需国际化再补）
 * - 完全自包含：手写 SVG path，不依赖外部 chart 库（避免给 ctcf-motif viewer 引入 d3/recharts）
 *
 * 职责：
 * - 接收 `records: CtcfGenotypeRecord[]`（每个 SNP 一条）
 * - 当前只展示首条记录的 ref/het/alt_hom 三态分布，未来可改为 small multiples（注释中已记）
 *
 * 关键算法：
 * - `polarToCartesian`：把"相对圆心的角度+半径"转回 SVG 屏幕坐标；
 *   -90° 偏移是因为 SVG y 轴向下，0° 对应"12 点钟方向"才符合饼图习惯
 * - `describeArc`：用 `M ... L ... A ... Z` 拼出扇形 path；
 *   large-arc-flag 通过 `(end - start) > 180` 判断，保证 >180° 扇形走长弧
 * - `PieChart`：`current` 是已经累加的角度游标，每片扇形起始角 = (prev/total)*360，
 *   结束角 = (now/total)*360——经典"游标累加"做法，无需复杂三角函数
 */
import type { JSX } from 'react';

import type { CtcfGenotypeRecord } from '../../../api/types';
import './tracks.css';

export interface CtcfGenotypePieProps {
  /** 后端返回的 SNP 基因型列表；当前仅取第一条展示 */
  records: CtcfGenotypeRecord[];
}

// 绿/橙/红对应 ref/het/alt——传统 "traffic light" 配色，符合直觉
const PIE_COLORS: Record<string, string> = {
  ref_hom: '#4caf50',
  het: '#ff9800',
  alt_hom: '#f44336',
};

// 与 PIE_COLORS 的 key 一一对应；未来如要 i18n 把这里抽到 messages 即可
const LABELS: Record<string, string> = {
  ref_hom: 'Ref hom',
  het: 'Het',
  alt_hom: 'Alt hom',
};

/**
 * 极坐标 → 笛卡尔坐标。
 * -90° 偏移让"0°"指向 12 点钟方向，配合 SVG y 轴向下避免饼图"上下颠倒"。
 */
function polarToCartesian(
  cx: number, cy: number, r: number, angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * 拼出"从圆心出发 → 起点 → 画弧到终点 → 闭合回圆心"的 SVG path。
 * large-arc-flag 必须正确：>180° 时为 1，否则为 0，否则扇形会画错方向。
 */
function describeArc(
  cx: number, cy: number, r: number,
  startAngle: number, endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

/**
 * 内部通用饼图：把 [{key, value}] 转成 SVG <path> 列表。
 * 注意 `sweep-flag=0` 表示逆时针——配合前面的 -90° 偏移能让扇形"按数据顺序顺时针展开"。
 */
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
    // 过滤 0 值：避免 0° 扇形产生退化 path（浏览器会画成"起点到起点"的零长度弧）
    .filter((d) => d.value > 0)
    .map((d) => {
      const startAngle = (current / total) * 360;
      current += d.value;
      const endAngle = (current / total) * 360;
      return {
        key: d.key,
        path: describeArc(cx, cy, r, startAngle, endAngle),
        // 未知 key 兜底灰色——避免后端加新类型时渲染失败
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

/**
 * 把 SNP 基因型分布渲染为饼图 + 图例。
 * 目前只展示 records[0]，注释里说明 alternative 是 small multiples。
 */
export function CtcfGenotypePie({ records }: CtcfGenotypePieProps): JSX.Element {
  // 业务约定：先只展示第一条 SNP 的分布。
  // alternative 设计：把全部 records 渲染成 N 个小饼图（small multiples）便于横向对比；
  // 暂未实现，等用户对当前展示形态有反馈后再切换。
  const main = records[0];

  if (!main) {
    return (
      <div className="ctcf-motif-panel">
        <h3>Genotype Distribution</h3>
        <p>No genotype data</p>
      </div>
    );
  }

  // 与 PIE_COLORS / LABELS 的 key 保持一致；顺序就是图例顺序
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
