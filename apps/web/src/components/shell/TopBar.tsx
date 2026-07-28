/**
 * TopBar — 应用顶部条（global header）。
 *
 * 架构位置：嵌入到 `AppShell` 顶部；作为全站常驻导航条。
 * 由品牌名、一级导航（目前只有 home）和语言切换器三部分组成。
 *
 * 为什么存在：统一品牌、入口与语言切换；让用户在任意 viewer 页面都能
 * 快速回到首页或切换语言，不需要借助浏览器历史。
 */
import type { JSX } from 'react';
import { Link } from 'react-router-dom';

import { useAppIntl } from '../../i18n';
import { I18nToggle } from '../../i18n/components/I18nToggle';

/**
 * 顶部条组件。
 *
 * 结构：
 *  - 品牌链接（点击回首页）
 *  - 主导航（用 `<nav>` 包裹并设 `aria-label`，便于无障碍读屏）
 *  - 右侧 i18n 切换器
 *
 * i18n：通过 `useAppIntl().t()` 取本地化文案；当前支持 zh/en。
 * 路由：使用 `react-router-dom` 的 `Link` 实现 SPA 内跳转，避免整页刷新。
 *
 * @returns 顶部条 JSX
 */
export function TopBar(): JSX.Element {
  const { t } = useAppIntl();

  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">dataWeb</Link>
      <nav className="topbar-nav topbar-nav--main" aria-label={t('nav.home')}>
        <Link to="/" className="topbar-btn">{t('nav.home')}</Link>
      </nav>
      <I18nToggle />
    </header>
  );
}
