/**
 * TopBar — 应用顶部条（global header）。
 *
 * 架构位置：嵌入到 `AppShell` 顶部；作为全站常驻导航条。
 * 由品牌名、一级导航（Home + 4 个 Explore viewer + Compare）和语言切换器
 * 三部分组成。
 *
 * 为什么存在：统一品牌、入口与语言切换；让用户在任意 viewer 页面都能
 * 快速跳转目标页面或切换语言，不需要借助浏览器历史。
 *
 * nav 列表：用 `NAV_ITEMS` 常量数组声明所有一级入口，便于新增/移除时
 * 单点修改。`NavLink` 取代 `Link` —— react-router 自动给当前路由对应的
 * 入口加 `.topbar-btn-active`，不需要手动 `useLocation()` 解析。
 *
 * i18n：通过 `useAppIntl().t()` 取本地化文案；当前支持 zh/en。每个 item
 * 自带英文 fallback，避免缺 key 时直接渲染 id。
 */
import type { JSX } from 'react';
import { NavLink } from 'react-router-dom';

import { useAppIntl } from '../../i18n';
import { I18nToggle } from '../../i18n/components/I18nToggle';

/** 一级导航项的声明式描述。 */
interface NavItem {
  /** react-router 跳转目标。 */
  readonly to: string;
  /** i18n key；缺 key 时回落到 defaultLabel。 */
  readonly labelKey: string;
  /** 英文 fallback，充当 defaultMessage。 */
  readonly defaultLabel: string;
  /** 精确匹配激活（仅 `/` 需要 —— 否则前缀匹配让 Home 在任意路由都高亮）。 */
  readonly end?: boolean;
}

/**
 * 顶部一级导航表。
 *
 * 顺序：从广义到专精（首页 → 数据总览 → 单一 viewer → 并排对比）。新增 viewer 时
 * 在 `3d` 之后、`ctcfMotif` 之前插入，保持 viewer 类目聚集；新增并列
 * 工作区类入口时追加到末尾。
 */
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/',                  labelKey: 'nav.home',         defaultLabel: 'Home', end: true },
  { to: '/database',          labelKey: 'nav.database',     defaultLabel: 'Database' },
  { to: '/explore/hic',       labelKey: 'nav.tracks.hic',   defaultLabel: 'Hi-C' },
  { to: '/explore/tracks',    labelKey: 'nav.tracks',       defaultLabel: 'Tracks' },
  { to: '/explore/3d',        labelKey: 'nav.3d',           defaultLabel: '3D' },
  { to: '/explore/ctcfMotif', labelKey: 'nav.ctcfMotif',    defaultLabel: 'CTCF Motif' },
  { to: '/compare',           labelKey: 'nav.compare',      defaultLabel: 'Compare' },
];

/**
 * 顶部条组件。
 *
 * 结构：
 *  - 品牌链接（点击回首页）
 *  - 主导航（用 `<nav>` 包裹并设 `aria-label`，便于无障碍读屏）
 *  - 右侧 i18n 切换器
 *
 * @returns 顶部条 JSX
 */
export function TopBar(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <header className="topbar">
      <LinkBrand />
      <nav className="topbar-nav topbar-nav--main" aria-label={t('nav.home')}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? 'topbar-btn topbar-btn-active' : 'topbar-btn'
            }
          >
            {t(item.labelKey, item.defaultLabel)}
          </NavLink>
        ))}
      </nav>
      <I18nToggle />
    </header>
  );
}

/**
 * 品牌链接（点击回首页）。
 *
 * 单独抽出来只是为了避免 `<NavLink>` 和品牌链接混在一个 JSX 块里影响
 * 阅读节奏 —— 品牌和 nav 的样式/语义都不同，拆分让两者职责更清晰。
 */
function LinkBrand(): JSX.Element {
  return (
    <NavLink to="/" className="topbar__brand" aria-label="dataWeb home">
      dataWeb
    </NavLink>
  );
}
