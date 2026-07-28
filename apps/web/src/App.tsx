import type { JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { CompareRoute } from './routes/compare';
import { HomeRoute } from './routes/home';
import { SampleRoute } from './routes/sample';
import { SpeciesRoute } from './routes/species';
import './routes/route.css';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/species/:species" element={<SpeciesRoute />} />
          <Route path="/sample/:id" element={<SampleRoute />} />
          <Route path="/compare/:a/:b" element={<CompareRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
