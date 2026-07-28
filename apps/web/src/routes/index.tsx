import { lazy, Suspense, type JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const Home = lazy(() => import('../pages/home/Home').then((module) => ({ default: module.Home })));
const Species = lazy(() => import('../pages/species/Species').then((module) => ({ default: module.Species })));
const Sample = lazy(() => import('../pages/sample/Sample').then((module) => ({ default: module.Sample })));
const Compare = lazy(() => import('../pages/compare/Compare').then((module) => ({ default: module.Compare })));

const PageFallback = () => <div className="route-loading">Loading…</div>;

export function AppRoutes(): JSX.Element {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/species/:species" element={<Species />} />
        <Route path="/sample/:id" element={<Sample />} />
        <Route path="/compare/:a/:b" element={<Compare />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
