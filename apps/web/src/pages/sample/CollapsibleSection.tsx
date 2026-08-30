/**
 * CollapsibleSection — Sample 详情页可收起区块外壳。
 *
 * 职责：把区块标题 `h3` 升级为可点击的切换按钮（带 `▸/▾` 箭头与
 * `aria-expanded`、`aria-controls`），折叠时内容从 DOM 卸载、只留标题行。
 *
 * 使用约束：仅用于概览/文件这类轻量信息区块。重型 viewer（Hi-C / 轨道 /
 * 3D / CTCF）不在这里折叠 —— 它们由 `SampleAnchorNav` 侧边栏勾选控制整块
 * 展示（勾掉即卸载，同时释放 WebGL / Plotly / three.js 资源）。
 *
 * 外壳与普通区块一致（`<section id data-section class="sample-section">`），
 * 保证右侧锚点导航点击时依然能定位到折叠中的区块。
 */

import type { JSX, ReactNode } from 'react';

import { useAppIntl } from '../../i18n';

interface CollapsibleSectionProps {
  /** 区块 id（= 锚点，`data-section`）。 */
  id: string;
  /** 区块标题（按钮可见文本）。 */
  title: string;
  /** 是否折叠（默认展开）。 */
  collapsed?: boolean;
  /** 切换回调。 */
  onToggle: () => void;
  children: ReactNode;
}

/**
 * 可折叠区块。折叠时卸载 children，展开时渲染；标题始终在 DOM 中。
 */
export function CollapsibleSection({
  id,
  title,
  collapsed = false,
  onToggle,
  children,
}: CollapsibleSectionProps): JSX.Element {
  const { t } = useAppIntl();
  return (
    <section
      id={id}
      data-section={id}
      className={'sample-section' + (collapsed ? ' sample-section--collapsed' : '')}
    >
      <h3 className="sample-section__title">
        <button
          type="button"
          className="sample-section__toggle"
          aria-expanded={!collapsed}
          aria-controls={`${id}--content`}
          title={
            collapsed
              ? t('sample.section.expand')
              : t('sample.section.collapse')
          }
          onClick={onToggle}
        >
          <span
            className={'sample-section__chevron' + (collapsed ? '' : ' sample-section__chevron--open')}
            aria-hidden="true"
          >
            ▸
          </span>
          {title}
        </button>
      </h3>
      {!collapsed && <div id={`${id}--content`}>{children}</div>}
    </section>
  );
}