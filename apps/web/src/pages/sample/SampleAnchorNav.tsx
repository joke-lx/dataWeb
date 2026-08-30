/**
 * SampleAnchorNav — Sample 详情页右侧锚点导航 + 滚动跟随。
 *
 * 职责：列出页面各区块（概览 / 文件 / Hi-C / 轨道 / 3D / CTCF），sticky
 * 在右侧；滚动时高亮当前区块，点击平滑滚动到对应 `<section data-section>`。
 * 可视区块（viz 模型）的导航项前有勾选框：取消勾选 → 区块隐藏，导航项置灰
 * 不可点（重新勾选可恢复）。
 *
 * 滚动跟随实现：
 *  - IntersectionObserver 活动带（rootMargin 让"上方 25% ~ 35%"成为活动区），
 *    命中即设为 active；
 *  - 滚动到底守卫：滚动容器（.route-content 祖先）滚到 ≥98% 时强制最后一节
 *    active —— 覆盖末节太短进不了活动带的边界情况。
 */

import { useEffect, useRef, useState, type JSX } from 'react';

import { useAppIntl } from '../../i18n';

/** 锚点项。 */
export interface SectionDef {
  id: string;
  labelKey: string;
  defaultLabel: string;
}

interface SampleAnchorNavProps {
  sections: readonly SectionDef[];
  compareActive?: boolean;
  a?: string;
  b?: string;
  /** 支持侧边栏勾选展示的区块 id（viz 模型）。 */
  toggleableIds?: readonly string[];
  /** 当前可见性映射（缺省 = 可见）。 */
  visible?: Record<string, boolean>;
  /** 勾选切换回调。 */
  onToggle?: (id: string) => void;
}

/**
 * 右侧锚点导航。
 */
export function SampleAnchorNav({
  sections,
  compareActive,
  a,
  b,
  toggleableIds,
  visible,
  onToggle,
}: SampleAnchorNavProps): JSX.Element {
  const { t } = useAppIntl();
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const scrollRootRef = useRef<HTMLElement | null>(null);

  // 找滚动容器（.route-content 祖先），用于底部守卫。
  useEffect(() => {
    const el = document.querySelector('.route-content');
    scrollRootRef.current = el instanceof HTMLElement ? el : null;
  }, []);

  // 滚动跟随。
  useEffect(() => {
    const nodes = sections
      .map((s) => document.querySelector<HTMLElement>(`[data-section="${s.id}"]`))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = e.target.getAttribute('data-section');
            if (id) setActiveId(id);
          }
        }
      },
      // 活动带：视口上方 25% 起、到 35% 止。
      { rootMargin: '-25% 0px -65% 0px' },
    );
    nodes.forEach((n) => observer.observe(n));

    // 底部守卫：滚到底强制最后一节。
    const root = scrollRootRef.current;
    const onScroll = () => {
      const el = root ?? document.scrollingElement;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight - 2;
      if (el.scrollTop >= max && nodes.length > 0) {
        const last = nodes[nodes.length - 1].getAttribute('data-section');
        if (last) setActiveId(last);
      }
    };
    root?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      root?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
    };
  }, [sections]);

  const jump = (id: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="sample-anchor-nav" aria-label={t('sample.anchorNav.label')}>
      <div className="sample-anchor-nav__inner">
        {compareActive && a && b && (
          <div className="sample-anchor-nav__compare-chip">
            {a} <span>vs</span> {b}
          </div>
        )}
        <ul>
          {sections.map((s) => {
            const label = t(s.labelKey, s.defaultLabel);
            const toggleable = toggleableIds?.includes(s.id) ?? false;
            const isVisible = toggleable ? (visible?.[s.id] ?? true) : true;
            return (
              <li key={s.id} className="sample-anchor-nav__item">
                {toggleable && (
                  <input
                    type="checkbox"
                    className="sample-anchor-nav__check"
                    checked={isVisible}
                    onChange={() => onToggle?.(s.id)}
                    aria-label={
                      isVisible
                        ? t('sample.nav.hideSection', { section: label })
                        : t('sample.nav.showSection', { section: label })
                    }
                  />
                )}
                <a
                  href={`#${s.id}`}
                  className={[
                    activeId === s.id ? 'active' : '',
                    isVisible ? '' : 'is-hidden',
                  ].filter(Boolean).join(' ')}
                  aria-disabled={!isVisible}
                  tabIndex={isVisible ? undefined : -1}
                  onClick={(event) => {
                    if (!isVisible) {
                      event.preventDefault();
                      return;
                    }
                    jump(s.id)(event);
                  }}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
