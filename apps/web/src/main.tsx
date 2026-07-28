import { StrictMode, useMemo, type JSX, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';

import { App } from './App';
import { i18nStore, setLocale, useAppSelector } from './i18n/store';
import enMessages from './i18n/messages/en.json';
import zhMessages from './i18n/messages/zh-CN.json';
import { detectLocaleFromUrl } from './i18n/url/localeFromUrl';
import './components/route/route.css';
import './styles/reset.css';
import './styles/tokens.css';

const initialLocale = detectLocaleFromUrl(
  new URLSearchParams(window.location.search),
  navigator.language,
);
i18nStore.dispatch(setLocale(initialLocale));

const queryClient = new QueryClient();

function I18nApp({ children }: { children: ReactNode }): JSX.Element {
  const locale = useAppSelector((state) => state.i18n.locale);
  const messages = useMemo(() => (locale === 'zh-CN' ? zhMessages : enMessages), [locale]);
  return <IntlProvider locale={locale} messages={messages} defaultLocale="en">{children}</IntlProvider>;
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider store={i18nStore}>
        <I18nApp><App /></I18nApp>
      </Provider>
    </QueryClientProvider>
  </StrictMode>,
);
