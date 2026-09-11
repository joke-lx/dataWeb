/**
 * ComparePanel —— Compare 工作区单个对比面板。
 *
 * 面板内容与单样本视图（/sample/:id 的 Hi-C 区块）**完全一致**：
 *  - 同一套轨道堆叠（Hi-C + AB Index + Insulation + TAD + Loops + PC1 +
 *    Gene，即单样本页默认勾选集）；
 *  - 同一形态的工具栏（RegionInput + bin + ZoomSlider）；
 *  - lane 内色标条可见、默认色标与单样本一致（'ref'）；
 *  - 点击锁定 + 十字线（CrosshairLayer，宿主带 `data-crosshair-id` 隔离
 *    多面板——鼠标所在面板才显示自己的十字线，锁定后各面板按同 bp 高亮）。
 *
 * 与单样本视图的差异仅在于"数据集管理"：
 *  - 面板头部带样本 id / 元数据 / 移除按钮；
 *  - 视口可独立（sync=false 时包 `PanelViewportProvider`；sync=true 时不包，
 *    所有面板共享全局视口）；
 *  - 面板的增删与会话由 /compare 左侧数据栏统一管理（Add Data / Clear All /
 *    Save Session / Synchronize All Charts）。
 */

import type { JSX } from 'react';

import type { Sample } from '../../api/types';
import { PanelViewportProvider } from '../../hooks/usePanelViewport';
import { useAppIntl } from '../../i18n';
import { RegionInput } from '../../components/nav/RegionInput';
import { ZoomSlider } from '../../components/nav/ZoomSlider';
import { GenomeBrowserView } from '../../components/models/tracks/GenomeBrowserView';
import { CrosshairLayer } from '../../components/overlay/CrosshairLayer';
import type { TrackId } from '../../components/models/tracks/trackSpec';

/** 与单样本视图默认勾选完全一致的轨道集（顺序 = 堆叠顺序）。 */
const COMPARE_TRACKS: readonly TrackId[] = ['ab', 'is', 'tad', 'loop', 'pc1', 'gene'];

interface ComparePanelProps {
  /** 面板对应的样本。 */
  sample: Sample;
  /** 是否与其它面板共享全局视口（Synchronize All Charts）。 */
  sync: boolean;
  /** 移除该面板（可选；缺省不显示移除按钮）。 */
  onRemove?: () => void;
}

/**
 * 对比面板：同步开 → 直接渲染（共享全局视口）；同步关 → 包独立视口 Provider。
 */
export function ComparePanel({
  sample,
  sync,
  onRemove,
}: ComparePanelProps): JSX.Element {
  const body = <ComparePanelBody sample={sample} onRemove={onRemove} />;
  return sync ? body : <PanelViewportProvider>{body}</PanelViewportProvider>;
}

/** 面板实际内容（头部 + 工具栏 + 一体化浏览器视图，与单样本一致）。 */
function ComparePanelBody({
  sample,
  onRemove,
}: {
  sample: Sample;
  onRemove?: () => void;
}): JSX.Element {
  const { t } = useAppIntl();

  return (
    <section className="compare-panel" data-sample-id={sample.id}>
      <header className="compare-panel__header">
        <div className="compare-panel__heading">
          <span className="compare-panel__title">{sample.id}</span>
          <span className="compare-panel__meta">
            {sample.tissue} · {sample.breed} · {sample.sex}
          </span>
        </div>
        {onRemove && (
          <button
            type="button"
            className="compare-panel__remove"
            onClick={onRemove}
            aria-label={t('compare.workspace.remove')}
          >
            ×
          </button>
        )}
      </header>

      {/* 工具栏：与单样本页 sample-region 一致（RegionInput · bin · ZoomSlider） */}
      <div className="compare-panel__toolbar">
        <RegionInput />
        <span className="compare-panel__sep" aria-hidden="true">·</span>
        <span className="compare-panel__bin-label">bin</span>
        <ZoomSlider />
      </div>

      {/* 主体：与单样本 Hi-C 区块一致（一体化视图 + 十字线宿主） */}
      <div className="compare-panel__body">
        <div
          className="gbv-hic-host"
          data-crosshair-host
          data-crosshair-id={sample.id}
        >
          <GenomeBrowserView
            sampleId={sample.id}
            tracks={COMPARE_TRACKS}
            labels={{
              tad: t('sample.genomeBrowser.tad'),
              loops: t('sample.genomeBrowser.loops'),
              pc1: t('sample.genomeBrowser.pc1'),
              gene: t('sample.genomeBrowser.gene'),
            }}
          />
          <CrosshairLayer hostId={sample.id} />
        </div>
      </div>
    </section>
  );
}

export default ComparePanel;
