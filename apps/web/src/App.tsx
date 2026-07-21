import type { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { AbIndexRoute } from './routes/AbIndexRoute';
import { CtcfLoopsRoute } from './routes/CtcfLoopsRoute';
import { DifferentialHicRoute } from './routes/DifferentialHicRoute';
import { GeneRoute } from './routes/GeneRoute';
import { H3K27acRoute } from './routes/H3K27acRoute';
import { H3K4me3Route } from './routes/H3K4me3Route';
import { HicRoute } from './routes/HicRoute';
import { InsulationScoreRoute } from './routes/InsulationScoreRoute';
import { PeiRoute } from './routes/PeiRoute';
import { RnaSeqRoute } from './routes/RnaSeqRoute';
import { SvRoute } from './routes/SvRoute';
import { TadRoute } from './routes/TadRoute';
import { ThreeDChromatinRoute } from './routes/ThreeDChromatinRoute';
import { ROUTES } from './routes/registry';
import './routes/route.css';

const ROUTE_COMPONENTS: Record<string, () => JSX.Element> = {
  hic: HicRoute,
  'differential-hic': DifferentialHicRoute,
  'ab-index': AbIndexRoute,
  'insulation-score': InsulationScoreRoute,
  tad: TadRoute,
  pei: PeiRoute,
  'ctcf-loops': CtcfLoopsRoute,
  'rna-seq': RnaSeqRoute,
  h3k4me3: H3K4me3Route,
  h3k27ac: H3K27acRoute,
  sv: SvRoute,
  gene: GeneRoute,
  '3d': ThreeDChromatinRoute,
};

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
                element={Component ? <Component /> : <Navigate to={ROUTES[0].path} replace />}
              />
            );
          })}
          <Route path="/" element={<Navigate to={ROUTES[0].path} replace />} />
          <Route
            path="*"
            element={<Navigate to={ROUTES[0].path} replace />}
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}