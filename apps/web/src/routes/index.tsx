/**
 * 路由表（react-router-dom v6）。
 *
 * 职责：把所有页面组件做成 `lazy()` 加载，配合一个 `<Suspense>` 包住整棵
 * 路由树。挂载顺序保持了 Home → Database → Species → Explore → Sample 的语义层级。
 *
 * 为什么不是顶级 `<Routes>`：本模块只导出 `AppRoutes`，由 `App.tsx` 嵌入
 * BrowserRouter 内；保持路由表与 Provider 装配分离。
 *
 * 未匹配路径统一 `<Navigate to="/" replace />` 兜底，避免死链暴露。
 */

import { lazy, Suspense, type JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

// 懒加载：每个页面按需 chunk，缩短首屏 JS 体积。
// `.then(module => ({ default: module.Home }))` 让默认导出 vs 命名导出兼容。
const Home = lazy(() => import('../pages/home/Home').then((module) => ({ default: module.Home })));
const Database = lazy(() => import('../pages/database/Database').then((module) => ({ default: module.Database })));
const Species = lazy(() => import('../pages/species/Species').then((module) => ({ default: module.Species })));
const Sample = lazy(() => import('../pages/sample/Sample').then((module) => ({ default: module.Sample })));
const Explore = lazy(() => import('../pages/explore/Explore').then((module) => ({ default: module.Explore })));
const Compare = lazy(() => import('../pages/compare/Compare').then((module) => ({ default: module.Compare })));
const CompareCase = lazy(() => import('../pages/compare/CompareCase').then((module) => ({ default: module.CompareCase })));
const CompareCases = lazy(() => import('../pages/compare/CompareCases').then((module) => ({ default: module.CompareCases })));

/** 路由 chunk 加载中的占位。触发 Suspense 时显示。 */
const PageFallback = () => <div className="route-loading">Loading…</div>;

/**
 * 应用路由出口。
 * - `/`                       Home (A-style landing)
 * - `/species/:species`       Species 落地页
 * - `/explore/:viewerType`    Explore 子 viewer（hic / tracks / 3d / ctcfMotif）
 * - `/sample/:id`             Sample 详情页（含 `?vs=` / `?tab=` / `?type=` / `?samples=`）
 * - `/compare`                A/B 自由选择工作区
 * - `/compare/cases`          案例库列表(8 条预设)
 * - `/compare/case/:id`       案例库预设直达（<Navigate replace> 到 /sample?vs=）
 * - `*`                       兜底重定向 Home
 */
export function AppRoutes(): JSX.Element {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/database" element={<Database />} />
        <Route path="/species/:species" element={<Species />} />
        <Route path="/explore/:viewerType" element={<Explore />} />
        <Route path="/sample/:id" element={<Sample />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/compare/cases" element={<CompareCases />} />
        <Route path="/compare/case/:id" element={<CompareCase />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
