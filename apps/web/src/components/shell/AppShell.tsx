/**
 * AppShell — 应用顶层三段式布局容器。
 *
 * 架构位置：位于 `App.tsx` 之下、路由树之上的全局 chrome 容器。
 * 任何路由（home / hic / differential / tracks / 3d / ctcf-motif）的页面
 * 内容都会作为 `children` 注入到中间的 `app-shell__main` 区域。
 *
 * 为什么存在：保证所有 viewer 共享一致的「顶部导航 + 内容 + 底部状态栏」框架，
 * 避免每个路由各自实现外壳样式导致视觉漂移。
 *
 * 子组件说明：
 *  - `TopBar`：品牌 + 一级导航 + i18n 切换
 *  - `StatusBar`：展示当前视口区间（chr:start-end）和数据来源
 *  - `children`：由 React Router 注入的当前路由内容
 */
import type { JSX, ReactNode } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import './shell.css';

/**
 * AppShell 的 props。
 *
 * @property children 路由注入的页面内容；会渲染到中部主区域。
 */
export interface AppShellProps {
  children: ReactNode;
}

/**
 * 应用外壳组件。
 *
 * 渲染 `.app-shell` 容器，按「TopBar / main / StatusBar」纵向三段堆叠。
 * CSS 布局（grid/flex）由 `shell.css` 定义。
 *
 * @param props 组件 props
 * @returns 完整的应用骨架
 */
export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-shell__main">{children}</main>
      <StatusBar />
    </div>
  );
}