/**
 * Tissue → colormap 映射，专供多样本 bigwig 叠加使用。
 *
 * 调色板来源：`docx/refrences/demo/tracks_offline.html:3927-3933`
 * （Berkshire / Tibetan / F1 三品种演示数据）。每个 tissue 提供一对颜色：
 *  - `line` —— 不透明描边色（线宽 0.8px）；
 *  - `fill` —— 半透明填充色（≈60% alpha），配合 Plotly `fill: 'tozeroy'` 使用。
 *
 * 已知 tissue 之外（Unknown / Pituitary 等）走 `FALLBACK` 中性灰。
 *
 * 架构位置：作为 `SamplePickerButton` / `BigwigStacked` 共享的纯数据模块，
 * 不依赖 React / 网络 / 视图，可被任何 lane 类型复用。
 */

export interface SampleColor {
  /** Stroke color for the trace line. */
  line: string;
  /** Fill color for `fill: 'tozeroy'` (already includes alpha). */
  fill: string;
}

const PALETTE: Record<string, SampleColor> = {
  Muscle: {
    // Berkshire (orange/tan) — 演示数据中 Berkshire 品种的主色。
    line: '#B5793B',
    fill: 'rgba(196, 138, 62, 0.60)',
  },
  Liver: {
    // Tibetan (blue) — Tibetan 品种在肝脏样本里使用的蓝。
    line: '#3E6DA3',
    fill: 'rgba(84, 127, 173, 0.60)',
  },
  Brain: {
    // Hybrid F1 (green) — 杂交 F1 后代在脑组织上的绿。
    line: '#2F8F4E',
    fill: 'rgba(60, 160, 90, 0.65)',
  },
};

// 中性灰兜底：catalog 里没收录的 tissue（Unknown / Pituitary / ...）走这里。
const FALLBACK: SampleColor = {
  // Neutral gray for tissues outside the catalog.
  line: '#666666',
  fill: 'rgba(102, 102, 102, 0.60)',
};

/**
 * 解析 tissue 名对应的 {line, fill}。未知 / 缺失 tissue 返回兜底调色板。
 *
 * @param tissue tissue 名称（可为 undefined / null，调用方便）
 * @returns 对应的颜色对
 */
export function colorForTissue(tissue: string | undefined | null): SampleColor {
  if (!tissue) return FALLBACK;
  return PALETTE[tissue] ?? FALLBACK;
}