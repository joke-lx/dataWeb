/**
 * 应用入口：装配 Providers + 初始化 locale + 挂载 React 树。
 *
 * 职责：
 * 1. 在 `<Provider>` 挂载之前同步派发初始 `setLocale`——i18n store 必须在
 *    React 子树渲染前就有正确值，否则首屏会闪烁。
 * 2. 根据 locale 选对应 messages 模块（`./i18n/messages/{en|zh-CN}.json`），
 *    用 `<IntlProvider>` 注入到整棵树。
 * 3. 包裹 TanStack Query 与 RTK Provider。
 *
 * 为什么 URL 是 i18n 单一 source of truth：见 `i18n/store/i18nSlice.ts`。
 * `detectLocaleFromUrl` 在浏览器加载时已经完成同步判定；后续用户切换
 * 语言由 `I18nToggle` 同步更新 URL + dispatch。
 */

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

// 启动阶段：直接从 URL 读 locale 并写入 store，避免首屏英文闪烁。
const initialLocale = detectLocaleFromUrl(
  new URLSearchParams(window.location.search),
  navigator.language,
);
i18nStore.dispatch(setLocale(initialLocale));

// 单一全局 QueryClient 供所有 useQuery 共享。
const queryClient = new QueryClient();

/**
 * 根据 store 当前 locale 选 messages 并注入 `<IntlProvider>`。
 * 把这个 hook 化包装放在 main.tsx 而不是 `App.tsx`，是为了让根级 store
 * 订阅尽早生效，配合首次 dispatch 决定 IntlProvider 的初始 messages。
 */
function I18nApp({ children }: { children: ReactNode }): JSX.Element {
  const locale = useAppSelector((state) => state.i18n.locale);
  // useMemo 避免 messages 对象在每次 render 都重新构造——react-intl 内部
  // 会用引用比较判断是否需要重新编译 formatter。
  const messages = useMemo(() => (locale === 'zh-CN' ? zhMessages : enMessages), [locale]);
  return <IntlProvider locale={locale} messages={messages} defaultLocale="en">{children}</IntlProvider>;
}

// 找不到根节点说明 index.html 模板出错——fail-loud 而非静默渲染到 undefined。
const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider store={i18nStore}>
        {/* Provider 必须包裹 I18nApp，以便后者能 useAppSelector 读 locale。 */}
        <I18nApp><App /></I18nApp>
      </Provider>
    </QueryClientProvider>
  </StrictMode>,
);
