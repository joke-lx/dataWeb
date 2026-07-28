/**
 * DifferentialModel — 差异 Hi-C 模型的 ModelFactory 入口组件。
 *
 * 架构位置：
 * - 由 `components/models/registry.ts` 通过 `lazy()` 加载，对应 `ModelType = 'differential'`
 * - 路由侧 `<RouteShell>` 包一层后挂到 `/samples/:sample/.../differential`
 * - 业务组件层（不是 render-kit）：知道 active sample、知道要对比两个 sample
 *
 * 职责：
 * - 解析"当前 sample A"和"对比 sample B"，并把 Log2Heatmap + GeneLane 组合成单个 viewer
 * - 不直接渲染数据，只负责挑选 sample 并向下传递
 *
 * Sample 选择策略：
 * - A：URL 中激活的 sample（active sample），缺省回落到 `Brain_BF3`
 * - B：从样本目录里"任选一个不同 tissue"的样本，缺省回落到 `Liver_BF3`
 *   这是为了保证即使样本目录为空，也能看到有意义的对照图
 */
import type { JSX } from 'react';

import { useActiveSample } from '../../../hooks/useActiveSample';
import { useSamples } from '../../../store/samples';
import { GeneLane } from './GeneLane';
import { Log2Heatmap } from './Log2Heatmap';

/**
 * 差异 Hi-C viewer 的根组件。
 *
 * 渲染顺序：log2 heatmap（主视觉） → 下方 gene lane（参考坐标）。
 * 两个组件共享 `viewport`（store 派生），所以它们天然对齐到同一个基因组区间。
 */
export function DifferentialModel(): JSX.Element {
  const activeId = useActiveSample();
  const samples = useSamples((s) => s.samples);
  const sampleA = activeId ?? 'Brain_BF3';
  // 业务约定：从样本目录里挑第一个"非 A"的样本作为对照；空目录时回落到 Liver_BF3
  // 这里不区分 tissue——只要 ID 不同即可，符合当前阶段"任意非自身对照"的实验性需求
  const sampleB = samples.find((s) => s.id !== sampleA)?.id ?? 'Liver_BF3';

  return (
    <>
      <Log2Heatmap sampleA={sampleA} sampleB={sampleB} />
      <GeneLane sampleId={sampleA} />
    </>
  );
}

export default DifferentialModel;