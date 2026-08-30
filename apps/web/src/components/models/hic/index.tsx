/**
 * Hi-C 业务模型的组合入口，位于 ModelFactory 注册表与 Hi-C 矩阵之间。
 * 该文件只负责解析一次当前样本并把矩阵交给 `render-kit/`，避免子组件因默认值不同
 * 而展示不一致的数据。
 *
 * TAD / Gene model lane 不再在此处渲染——它们已在 `models/tracks/` 中作为独立
 * lane 实现（`tracks/TadBar`、`tracks/GeneLane`），用户通过 Tracks sub-tab 即可
 * 加载（多数 sub-tab 的 aux 都包含 `['tad', 'gene']`，见 `tracks/trackSpec.ts`）。
 * 重复出现在 Hi-C + Tracks 双 section 会导致同一轨道渲染两次，浪费带宽与 GPU。
 */
import type { JSX } from 'react';

import { useActiveSample } from '../../../hooks/useActiveSample';
import { HiCMatrix } from './HiCMatrix';

/**
 * 组装 ModelFactory 所需的完整 Hi-C 视图。
 *
 * @returns 只渲染 Hi-C 接触矩阵；TAD / Gene 等辅助 lane 改由 Tracks section 提供。
 */
export function HicModel(): JSX.Element {
  // 在组合层统一兜底，确保矩阵查询的样本与 Tracks section 默认样本一致。
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return <HiCMatrix sampleId={sampleId} />;
}

export default HicModel;