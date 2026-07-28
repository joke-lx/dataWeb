/**
 * ThreeDModel — 3D 染色质模型的 ModelFactory 入口。
 *
 * 架构位置：
 * - 由 `components/models/registry.ts` 通过 `lazy()` 加载，对应 `ModelType = '3d'`
 * - 业务组件层：决定"展示哪个 panel"，不涉及 Three.js 细节
 *
 * 职责：
 * - 根据当前 active sample 的组织类型（tissue）自动选择对应的 organ 面板
 * - Brain / Liver / Muscle 各自有不同随机种子 → 不同 3D 折叠形态
 * - 只有 brain 面板展示真实 PEI 增强子 loop 数据
 * - explore 模式（无 active sample）默认使用 brain 面板
 */
import { JSX } from 'react';

import { useAppIntl } from '../../../i18n';
import { ThreeDChromatin } from './ThreeDChromatin';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { useSampleCatalog } from '../../../hooks/useSampleCatalog';

/** Sample.tissue → ThreeDChromatin organ prop */
function tissueToOrgan(tissue: string): 'liver' | 'muscle' | 'brain' {
  const lower = tissue.toLowerCase();
  if (lower.includes('liver')) return 'liver';
  if (lower.includes('muscle')) return 'muscle';
  return 'brain';
}

/**
 * 3D chromatin model — 单面板视图
 * 根据当前 active sample 的组织类型决定 organ 和 PEI 数据源。
 * sample 的 tissue → organ 映射：
 *   Brain → brain（含增强子/启动子 + PEI loop）
 *   Liver → liver（固定随机几何 + 增强子/启动子标记）
 *   Muscle → muscle（固定随机几何，无标记）
 * explore 页面（active 为空）默认展示 Brain 面板。
 */
export function ThreeDModel(): JSX.Element {
  const { t } = useAppIntl();
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  const { samples } = useSampleCatalog();

  // 从 catalog 查找样本的 tissue，决定 organ
  const sampleMeta = samples?.find((s) => s.id === activeSample);
  const organ = tissueToOrgan(sampleMeta?.tissue ?? 'Brain');

  return (
    <div className="three-d-grid">
      <div className="three-d-panel">
        <div className="three-d-panel__canvas">
          <ThreeDChromatin organ={organ} sampleId={activeSample} />
        </div>
        <span className="three-d-panel__label">
          {sampleMeta
            ? `${sampleMeta.tissue} · ${sampleMeta.id}`
            : t('3d.tissue.' + organ)}
        </span>
      </div>
      <div className="three-d-hint">
        {t('3d.viewer.hint')}
      </div>
    </div>
  );
}

export default ThreeDModel;
