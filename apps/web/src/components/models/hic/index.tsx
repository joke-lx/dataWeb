/**
 * Hi-C 业务模型的组合入口，位于 ModelFactory 注册表与各条业务轨道之间。
 * 该文件只负责解析一次当前样本并编排矩阵、TAD 与基因轨道，避免各子组件因默认值不同而展示不一致的数据。
 */
import type { JSX } from 'react';

import { useActiveSample } from '../../../hooks/useActiveSample';
import { GeneLane } from './GeneLane';
import { HiCMatrix } from './HiCMatrix';
import { TadBar } from './TadBar';

/**
 * 组装 ModelFactory 所需的完整 Hi-C 视图。
 *
 * @returns 共享同一样本上下文的矩阵、TAD 与基因轨道。
 */
export function HicModel(): JSX.Element {
  // 在组合层统一兜底，确保三个独立查询不会因各自解析样本而产生跨样本错位。
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <>
      <HiCMatrix sampleId={sampleId} />
      <TadBar sampleId={sampleId} />
      <GeneLane sampleId={sampleId} />
    </>
  );
}

export default HicModel;