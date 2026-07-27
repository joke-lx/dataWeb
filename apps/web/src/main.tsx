import { StrictMode, useMemo } from 'react';
import type { JSX, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { i18nStore, useAppSelector, setLocale } from './i18n/store';
import { detectLocaleFromUrl } from './i18n/url/localeFromUrl';
import enMessages from './i18n/messages/en.json';
import zhMessages from './i18n/messages/zh-CN.json';
import { AppShell } from './components/shell/AppShell';
import { HicRoute } from './routes/hic';
import { DifferentialHicRoute } from './routes/differential';
import { TracksRoute } from './routes/tracks';
import { ThreeDChromatinRoute } from './routes/3d';
import { HomeRoute } from './routes/home';
import { CtcfMotifRoute } from './routes/ctcf-motif';
import { LEGACY_REDIRECTS, ROUTES } from './routes/registry';
import './routes/route.css';
import './styles/reset.css';
import './styles/tokens.css';

// Initialize locale from URL before first render
const initialLocale = detectLocaleFromUrl(
  new URLSearchParams(window.location.search),
  navigator.language,
);
i18nStore.dispatch(setLocale(initialLocale));

const queryClient = new QueryClient();

const ROUTE_COMPONENTS: Record<string, () => JSX.Element> = {
  hic: HicRoute,
  differential: DifferentialHicRoute,
  tracks: TracksRoute,
  '3d': ThreeDChromatinRoute,
  'ctcf-motif': CtcfMotifRoute,
};

const DEFAULT_PATH = ROUTES[0].path;

function I18nApp({ children }: { children: ReactNode }): JSX.Element {
  const locale = useAppSelector((s) => s.i18n.locale);
  const messages = useMemo(
    () => (locale === 'zh-CN' ? zhMessages : enMessages),
    [locale],
  );
  return (
    <IntlProvider locale={locale} messages={messages} defaultLocale="en">
      {children}
    </IntlProvider>
  );
}

export function App(): JSX.Element {
  return (
    <Provider store={i18nStore}>
      <I18nApp>
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
              {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}
              <Route path="/" element={<HomeRoute />} />
              <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </I18nApp>
    </Provider>
  );
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
