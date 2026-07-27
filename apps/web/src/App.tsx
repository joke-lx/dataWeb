import type { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { HicRoute } from './routes/hic';
import { DifferentialHicRoute } from './routes/differential';
import { TracksRoute } from './routes/tracks';
import { ThreeDChromatinRoute } from './routes/3d';
import { HomeRoute } from './routes/home';
import { CtcfMotifRoute } from './routes/ctcf-motif';
import { LEGACY_REDIRECTS, ROUTES } from './routes/registry';
import './routes/route.css';

const ROUTE_COMPONENTS: Record<string, () => JSX.Element> = {
  hic: HicRoute,
  differential: DifferentialHicRoute,
  tracks: TracksRoute,
  '3d': ThreeDChromatinRoute,
  'ctcf-motif': CtcfMotifRoute,
};

const DEFAULT_PATH = ROUTES[0].path;

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          {ROUTES.map((r) => {
            const Component = ROUTE_COMPONENTS[r.id];
            return (
              <Route
                key={r.id}
                path={r.path}
                element={Component ? <Component /> : <Navigate to={DEFAULT_PATH} replace />}
              />
            );
          })}

          {/* Legacy URL redirects — preserve external links and bookmarks */}
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}

          <Route path="/" element={<HomeRoute />} />
          <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
