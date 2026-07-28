import type { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './components/shell/AppShell';
import { AppRoutes } from './routes';
import './components/route/route.css';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell>
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
