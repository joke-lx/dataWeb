import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { CompareRoute } from './routes/compare';
import { HomeRoute } from './routes/home';
import { SampleRoute } from './routes/sample';
import { SamplesRoute } from './routes/samples';
import { LEGACY_REDIRECTS } from './routes/registry';
import './routes/route.css';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/samples" element={<SamplesRoute />} />
          <Route path="/sample/:id" element={<SampleRoute />} />
          <Route path="/compare/:a/:b" element={<CompareRoute />} />
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
