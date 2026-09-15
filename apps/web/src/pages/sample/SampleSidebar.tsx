/**
 * SampleSidebar — Sample 详情页左侧"数据 / 轨道控制台"。
 *
 * 职责：按参考站点详细页形态重构 —— 左侧窄栏承担数据管理与轨道控制：
 *   1. 样本卡：当前样本（对比模式显示 vs 对方）+ 核心元数据 + 参考基因组；
 *   2. 视图区块：全站区块列表（点击跳转、滚动跟随高亮），4 个可视化区块
 *      带勾选开关（取消勾选 → 整块卸载，释放 WebGL / Plotly / three.js）；
 *   3. Tracks 轨道：按 Sequencing / Structure / Annotation 分组的多选
 *      轨道（复用 `?types=` 多选逻辑，决定 tracks 区块的轨道堆叠）；
 *   4. 数据文件：轻量文件摘要，点击跳转到主区文件区块下载。
 *
 * 取代原右侧 `SampleAnchorNav`（锚点 + 勾选职责合并到左侧，贴近基因组
 * 浏览器"左数据栏 + 右画布"的形态）。
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

import type { Sample } from '../../api/types';
import { SUB_TABS, type TrackId } from '../../components/models/tracks/trackSpec';
import { useAppIntl } from '../../i18n';

/** 锚点区块定义（与渲染顺序一致）。 */
export interface SectionDef {
  id: string;
  labelKey: string;
  defaultLabel: string;
}

interface SampleSidebarProps {
  sections: readonly SectionDef[];
  sample: Sample;
  partner?: Sample;
  compareActive?: boolean;
  /** 支持勾选展示的区块 id（viz 模型）。 */
  toggleableIds?: readonly string[];
  /** 当前可见性映射（缺省 = 可见）。 */
  visible?: Record<string, boolean>;
  /** 区块勾选切换回调。 */
  onToggleVisible?: (id: string) => void;
  /** Tracks 多选轨道（`?types=`）。 */
  selectedTypes: TrackId[];
  /** 轨道勾选切换回调。 */
  onToggleType: (id: string) => void;
  /** 跳转到文件区块（下载入口）。 */
  onDownload: () => void;
  /** 附加内容（概览 / 文件折叠卡），渲染在侧栏滚动区末尾。 */
  children?: ReactNode;
}

/** 轨道分组渲染顺序。 */
const TRACK_GROUPS: ReadonlyArray<{ id: 'sequencing' | 'structure' | 'gene'; labelKey: string }> = [
  { id: 'sequencing', labelKey: 'tracks.group.sequencing' },
  { id: 'structure', labelKey: 'tracks.group.structure' },
  { id: 'gene', labelKey: 'tracks.group.gene' },
];

/**
 * 左侧数据 / 轨道控制台。
 */
export function SampleSidebar({
  sections,
  sample,
  partner,
  compareActive,
  toggleableIds,
  visible,
  onToggleVisible,
  selectedTypes,
  onToggleType,
  onDownload,
  children,
}: SampleSidebarProps): JSX.Element {
  const { t } = useAppIntl();
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const scrollRootRef = useRef<HTMLElement | null>(null);

  // 滚动容器（.route-content 祖先），用于底部守卫。
  useEffect(() => {
    const el = document.querySelector('.route-content');
    scrollRootRef.current = el instanceof HTMLElement ? el : null;
  }, []);

  // 滚动跟随：视口上方活动带 + 滚到底守卫（沿用原 SampleAnchorNav 逻辑）。
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
      { rootMargin: '-25% 0px -65% 0px' },
    );
    nodes.forEach((n) => observer.observe(n));

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

  const assembly = sample.species === 'pig' ? 'Sscrofa11.1' : 'GRCg6a';

  return (
    <aside className="sample-sidebar" aria-label={t('sample.sidebar.label')}>
      {/* ── 样本卡（对齐设计稿：编号 + GSE 徽章 + Type/Assembly） ── */}
      <div className="sample-sidebar__sample">
        <div className="sample-sidebar__row-head">
          <span className="sample-sidebar__num">1.</span>
          <span className="sample-sidebar__sample-name">
            {sample.id}
            {compareActive && partner && (
              <span className="sample-sidebar__vs">
                <em>vs</em> {partner.id}
              </span>
            )}
          </span>
        </div>
        <div className="sample-sidebar__gse">GSE-mock</div>
        <dl className="sample-sidebar__meta">
          <div><dt>Type</dt><dd>Hi-C</dd></div>
          <div><dt>Assembly</dt><dd>{assembly}</dd></div>
        </dl>
      </div>

      {/* ── 视图区块 ── */}
      <section className="sample-sidebar__group">
        <h4>{t('sample.sidebar.sections')}</h4>
        <ul className="sample-sidebar__list">
          {sections.map((s) => {
            const label = t(s.labelKey, s.defaultLabel);
            const toggleable = toggleableIds?.includes(s.id) ?? false;
            const isVisible = toggleable ? (visible?.[s.id] ?? true) : true;
            return (
              <li key={s.id} className="sample-sidebar__row">
                {toggleable && (
                  <input
                    type="checkbox"
                    className="sample-sidebar__check"
                    checked={isVisible}
                    onChange={() => onToggleVisible?.(s.id)}
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
                    'sample-sidebar__link',
                    activeId === s.id ? 'is-active' : '',
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
      </section>

      {/* ── Tracks 轨道多选 ── */}
      <section className="sample-sidebar__group">
        <h4>{t('sample.sidebar.tracks')}</h4>
        {TRACK_GROUPS.map((group) => {
          const items = SUB_TABS.filter((tab) => tab.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="sample-sidebar__subgroup">
              <span className="sample-sidebar__subgroup-label">{t(group.labelKey)}</span>
              <ul className="sample-sidebar__list">
                {items.map((tab) => {
                  const label = t(`tracks.subtab.${tab.id}`, tab.label);
                  const checked = selectedTypes.includes(tab.id);
                  return (
                    <li key={tab.id} className="sample-sidebar__row">
                      <input
                        type="checkbox"
                        className="sample-sidebar__check"
                        checked={checked}
                        onChange={() => onToggleType(tab.id)}
                        aria-label={label}
                      />
                      <span className="sample-sidebar__track-label">{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* ── 数据文件摘要 ── */}
      <section className="sample-sidebar__group">
        <h4>{t('sample.sidebar.files')}</h4>
        <ul className="sample-sidebar__files">
          <li><span className="sample-sidebar__file-name">Hi-C</span><span className="sample-sidebar__file-fmt">.mcool</span></li>
          <li><span className="sample-sidebar__file-name">RNA-seq</span><span className="sample-sidebar__file-fmt">.bw</span></li>
          <li><span className="sample-sidebar__file-name">ChIP-seq</span><span className="sample-sidebar__file-fmt">.bw</span></li>
          <li><span className="sample-sidebar__file-name">Variants</span><span className="sample-sidebar__file-fmt">.vcf.gz</span></li>
        </ul>
        <button type="button" className="sample-sidebar__btn sample-sidebar__btn--muted" onClick={onDownload}>
          {t('sample.sidebar.download')} →
        </button>
      </section>

      {/* ── 概览 / 文件（内嵌左栏滚动区，不挤占右侧可视化） ── */}
      {children}
    </aside>
  );
}
