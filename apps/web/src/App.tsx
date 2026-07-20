import type { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { ROUTES } from './routes/registry';

function PagePlaceholder({ id }: { id: string }): JSX.Element {
  return (
    <main className="page-placeholder">
      <h2>{id}</h2>
      <p>This route will be wired to its dedicated track components in Task K.</p>
    </main>
  );
}

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          {ROUTES.map((r) => (
            <Route
              key={r.id}
              path={r.path}
              element={<PagePlaceholder id={r.label} />}
            />
          ))}
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