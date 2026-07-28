/**
 * ThreeDModel — 3D 染色质模型的 ModelFactory 入口。
 *
 * 架构位置：
 * - 由 `components/models/registry.ts` 通过 `lazy()` 加载，对应 `ModelType = '3d'`
 * - 业务组件层：决定"展示几个 panel / 用哪些 sample"，不涉及 Three.js 细节
 *
 * 职责：
 * - 渲染三个独立的"rainbow-tube" chromatin panel：liver / muscle / brain
 * - 只把 active sample 喂给 brain panel（PEI 数据依赖具体样本）；其它 panel 用固定随机几何
 * - 每个 panel 拥有独立 canvas / orbit 状态，互不干扰（见 ThreeDChromatin 注释）
 *
 * 设计取舍：
 * - 用硬编码 organs 数组而不是 props 驱动：当前 3D viewer 永远展示这三种组织，
 *   后续如果需要"自定义器官列表"再考虑升级成 prop
 * - 提示文案 `3d.viewer.hint` 走 i18n，避免硬编码中英文
 */
import { JSX } from 'react';

import { useAppIntl } from '../../../i18n';
import { ThreeDChromatin } from './ThreeDChromatin';
import { useActiveSample } from '../../../hooks/useActiveSample';

/**
 * 3D chromatin model — 三块独立的 rainbow-tube 染色质面板（Liver/Muscle/Brain）
 * 垂直堆叠，每块 360×220 px，右侧带组织标签。
 * Brain 面板会基于 active sample 的 PEI 记录叠加 enhancer/loop 几何。
 * 每块面板各自拥有 orbit 状态——一块 canvas 上的拖拽不会影响其他面板。
 */
export function ThreeDModel(): JSX.Element {
  const { t } = useAppIntl();
  const activeSample = useActiveSample() ?? 'Brain_BF3';
  const organs: Array<'liver' | 'muscle' | 'brain'> = ['liver', 'muscle', 'brain'];

  return (
    <div className="three-d-grid">
      {organs.map((organ) => (
        <div key={organ} className="three-d-panel">
          <div className="three-d-panel__canvas">
            {/* sampleId 只对 brain 透传：liver/muscle 用 ORGAN_PARAMS 里的固定随机种子更稳定 */}
            <ThreeDChromatin
              organ={organ}
              sampleId={organ === 'brain' ? activeSample : undefined}
            />
          </div>
          <span className="three-d-panel__label">
            {t('3d.tissue.' + organ)}
          </span>
        </div>
      ))}
      <div className="three-d-hint">
        {t('3d.viewer.hint')}
      </div>
    </div>
  );
}

export default ThreeDModel;
