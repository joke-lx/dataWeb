/**
 * App — React 应用的最外层根组件。
 *
 * 架构位置：被 `main.tsx`（Vite 入口）挂载；位于 React 树最顶端。
 * 负责两件事：
 *  1. 初始化 `BrowserRouter`，启用 HTML5 history 模式的客户端路由
 *  2. 把 `AppShell` 套到所有路由外面，让所有页面共享 chrome 框架
 *
 * 为什么存在：把「路由 + 全局布局」这两层关注点与具体页面分离；这样
 * 路由表（`AppRoutes`）只关心路径到组件的映射，shell 布局只在最外层
 * 声明一次，避免每个路由各自包 `<TopBar />` / `<StatusBar />`。
 */
import type { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { AppRoutes } from './routes';
import './components/route/route.css';

/**
 * 根组件。
 *
 * 渲染顺序：BrowserRouter → AppShell → AppRoutes → 当前路由页面。
 * `AppShell` 必须在 `AppRoutes` 外面，保证所有路由都共享同一份 chrome。
 *
 * @returns 应用根 JSX
 */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
