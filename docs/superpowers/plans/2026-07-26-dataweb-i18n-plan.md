# dataWeb i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese / English toggle (zh-CN / en) to the dataWeb genome browser with RTK state management, URL persistence, and react-intl rendering.

**Architecture:** URL `?lang=zh-CN|en` is single source of truth → RTK `i18nSlice` (coexists with existing zustand stores) → `react-intl IntlProvider` consumes static JSON dictionaries → all components read via `useIntl().formatMessage({id})`.

**Tech Stack:** Redux Toolkit + react-intl + @formatjs/intl + existing react-router-dom (URL state = `useSearchParams`)

## Global Constraints

- `locale` type: `'zh-CN' | 'en'`
- Translation key format: `snake_case` dot-scoped (`home.hero.title`)
- Two JSON files: `en.json` (fallback), `zh-CN.json` (primary)
- No lazy loading — both JSON files bundled at build time (combined < 10 KB)
- No backend changes
- Existing zustand stores (`useSamples`, `useViewport`) NOT migrated to RTK
- Fallback chain: zh-CN → en → key itself (as console.warn in dev, silent in prod)
- Plural / date / number: native Intl API only; no ICU MessageFormat syntax in JSON values
- I18nToggle placement: TopBar right side, before species toggle
- URL `?lang=` preserved on route changes via existing `setParams` callback form
- CI lint: `pnpm i18n:check` — grep static `formatMessage({id: '...'})` calls vs en.json keys

---

### Task 1: Add npm dependencies + scaffold directory

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/i18n/` directory tree

**Interfaces:**
- Consumes: (none)
- Produces: installed deps + empty `i18n/` skeletons

- [ ] **Step 1: Install 4 new deps**

```bash
pnpm add @reduxjs/toolkit react-redux react-intl @formatjs/intl
```

- [ ] **Step 2: Create i18n directory skeleton**

```bash
mkdir -p apps/web/src/i18n/store apps/web/src/i18n/messages apps/web/src/i18n/hooks apps/web/src/i18n/components apps/web/src/i18n/url
touch apps/web/src/i18n/index.ts apps/web/src/i18n/store/i18nSlice.ts apps/web/src/i18n/store/index.ts apps/web/src/i18n/hooks/useAppIntl.ts apps/web/src/i18n/components/I18nToggle.tsx apps/web/src/i18n/components/I18nToggle.css apps/web/src/i18n/url/localeFromUrl.ts apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/zh-CN.json
```

- [ ] **Step 3: Verify build still passes**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/i18n/
git commit -m "chore: scaffold i18n directory + add redux toolkit / react-intl deps"
```

---

### Task 2: i18nSlice (RTK slice)

**Files:**
- Create: `apps/web/src/i18n/store/i18nSlice.ts`

**Interfaces:**
- Consumes: (none — standalone slice)
- Produces: `I18nState`, `setLocale`, `i18nReducer`, `locale`, `I18nSlice`

- [ ] **Step 1: Write i18nSlice**

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Locale = 'zh-CN' | 'en';

export interface I18nState {
  locale: Locale;
}

const initialState: I18nState = {
  locale: 'en',
};

export const i18nSlice = createSlice({
  name: 'i18n',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
    },
  },
});

export const { setLocale } = i18nSlice.actions;
export const i18nReducer = i18nSlice.reducer;
export type I18nSlice = ReturnType<typeof i18nReducer>;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/store/i18nSlice.ts
git commit -m "feat(i18n): add RTK slice for locale state"
```

---

### Task 3: URL ↔ locale sync

**Files:**
- Create: `apps/web/src/i18n/url/localeFromUrl.ts`

**Interfaces:**
- Consumes: `Locale` from `i18nSlice.ts`
- Produces: `detectLocaleFromUrl(params: URLSearchParams, navigatorLanguage?: string): Locale`

- [ ] **Step 1: Write localeFromUrl.ts**

```ts
import type { Locale } from '../store/i18nSlice';

export function detectLocaleFromUrl(
  params: URLSearchParams,
  navigatorLanguage?: string,
): Locale {
  // 1. explicit ?lang= in URL
  const lang = params.get('lang');
  if (lang === 'zh-CN') return 'zh-CN';
  if (lang === 'en') return 'en';

  // 2. browser Accept-Language
  if (navigatorLanguage && navigatorLanguage.startsWith('zh')) return 'zh-CN';

  // 3. fallback
  return 'en';
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/url/localeFromUrl.ts
git commit -m "feat(i18n): add URL -> locale detection"
```

---

### Task 4: Redux store + IntlProvider + Provider assembly

**Files:**
- Create: `apps/web/src/i18n/store/index.ts`
- Modify: `apps/web/src/main.tsx` (wrap app with Provider + IntlProvider)

**Interfaces:**
- Consumes: `i18nReducer`, `setLocale` from slice
- Produces: `<Provider>` wrapper around `<IntlProvider>` around app

- [ ] **Step 1: Write /i18n/store/index.ts**

```ts
import { configureStore } from '@reduxjs/toolkit';
import { i18nReducer, setLocale, type Locale } from './i18nSlice';

export const i18nStore = configureStore({
  reducer: { i18n: i18nReducer },
});

export type RootState = ReturnType<typeof i18nStore.getState>;
export type AppDispatch = typeof i18nStore.dispatch;

export { setLocale };
export type { Locale };
```

- [ ] **Step 2: Edit main.tsx**

Read current `apps/web/src/main.tsx`. At top of file:

```ts
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { i18nStore, setLocale, type Locale } from './i18n/store';
import { detectLocaleFromUrl } from './i18n/url/localeFromUrl';
```

Inside the `App()` component (or before the BrowserRouter creation):

```ts
// ——— i18n startup ———
const initialLocale = detectLocaleFromUrl(
  new URLSearchParams(window.location.search),
  navigator.language,
);
i18nStore.dispatch(setLocale(initialLocale));
```

Wrap the `<AppShell>` (or the `<BrowserRouter>`) with:

```tsx
<Provider store={i18nStore}>
  <I18nProviderShell />
</Provider>
```

Where `I18nProviderShell` is a new wrapper component that reads locale from RTK and loads messages:

```tsx
import { useI18nMessages } from '../i18n/hooks/useI18nMessages';

function I18nProviderShell({ children }: { children: React.ReactNode }) {
  const locale = useAppSelector((state) => state.i18n.locale);
  const messages = useMemo(() => {
    if (locale === 'zh-CN') return require('../i18n/messages/zh-CN.json');
    return require('../i18n/messages/en.json');
  }, [locale]);

  return (
    <IntlProvider locale={locale} messages={messages} defaultLocale="en">
      {children}
    </IntlProvider>
  );
}
```

> Note: Use `import enMessages from '../i18n/messages/en.json'` (Vite resolves JSON to default export). Same for zh-CN. The import module-level is fine (both files bundled at build time).

**Actual implementation code** (precise, no placeholders):

```tsx
// main.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { useMemo } from 'react';
import { i18nStore, setLocale, useAppSelector } from './i18n/store';
import { detectLocaleFromUrl } from './i18n/url/localeFromUrl';
import enMessages from './i18n/messages/en.json';
import zhMessages from './i18n/messages/zh-CN.json';
import { AppShell } from './components/shell/AppShell';
// ... rest of existing imports

// Initialize locale from URL before first render
const initialLocale = detectLocaleFromUrl(
  new URLSearchParams(window.location.search),
  navigator.language,
);
i18nStore.dispatch(setLocale(initialLocale));

function I18nApp({ children }: { children: React.ReactNode }) {
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
              {/* ... existing routes unchanged ... */}
            </Routes>
          </AppShell>
        </BrowserRouter>
      </I18nApp>
    </Provider>
  );
}
```

Also need `useAppSelector` / `useAppDispatch` typed hooks. Add to `apps/web/src/i18n/store/index.ts`:

```ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

If type errors, fix them (likely Vite JSON import typing — add `"resolveJsonModule": true` in tsconfig if needed; this may already be present for `tokens.css` ; check `apps/web/tsconfig.json`). Types from `react-intl` may need `"dom"` lib which is likely already present.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/store/index.ts apps/web/src/i18n/store/i18nSlice.ts apps/web/src/main.tsx
git commit -m "feat(i18n): wire RTK store + IntlProvider into app root"
```

---

### Task 5: Static translation dictionaries (en.json + zh-CN.json)

**Files:**
- Create: `apps/web/src/i18n/messages/en.json`
- Create: `apps/web/src/i18n/messages/zh-CN.json`

**Interfaces:**
- Consumes: key convention from spec
- Produces: two JSON objects with same keys; zh-CN values translated

- [ ] **Step 1: Write en.json (fallback)**

```json
{
  "home.hero.title": "Browse multi-omics 3D genome data",
  "home.hero.lede": "Explore sample-level Hi-C maps alongside gene expression, epigenomic peaks, structural variation, and 3D genome features in pigs and chickens.",
  "home.species.pig.latinName": "Sus scrofa",
  "home.species.pig.sampleCount": "Samples",
  "home.species.pig.tissueCount": "Tissues",
  "home.species.pig.breedCount": "Breeds",
  "home.species.chicken.latinName": "Gallus gallus",
  "home.comparison.tissue.title": "Tissue",
  "home.comparison.tissue.description": "Compare chromatin organization and signal tracks across organs.",
  "home.comparison.breed.title": "Breed",
  "home.comparison.breed.description": "Inspect genomic differences between breeds within a species.",
  "home.comparison.cross.title": "Reciprocal cross",
  "home.comparison.cross.description": "Contrast parental-origin and reciprocal-cross datasets.",
  "home.comparison.developmental.title": "Developmental",
  "home.comparison.developmental.description": "Follow 3D genome features across developmental time points.",
  "tracks.subtab.rna_seq": "RNA-seq",
  "tracks.subtab.h3k4me3": "H3K4me3",
  "tracks.subtab.h3k27ac": "H3K27ac",
  "tracks.subtab.ab": "AB Index",
  "tracks.subtab.is": "IS",
  "tracks.subtab.tad": "TAD",
  "tracks.subtab.pei": "PEI",
  "tracks.subtab.loop": "Loops",
  "tracks.subtab.sv": "SV",
  "tracks.subtab.gene": "Gene",
  "tracks.samplePicker.title": "Add sample",
  "tracks.samplePicker.noSelection": "No samples selected",
  "hic.viewer.title": "Hi-C contact map",
  "differential.viewer.title": "Differential Hi-C (log2 A / B)",
  "3d.viewer.title": "3D chromatin folding",
  "ctcf.viewer.title": "CTCF motif at active region",
  "common.loading": "Loading…",
  "common.error": "Error",
  "common.share": "Share",
  "common.downloadPng": "PNG",
  "common.downloadCsv": "CSV",
  "common.search": "Search",
  "common.region": "Region",
  "common.sampleId": "Sample ID",
  "common.species": "Species",
  "common.switchTo.en": "EN",
  "common.switchTo.zh-CN": "中文",
  "site.title": "dataWeb — Multi-omics 3D Genome Browser",
  "site.footer.disclaimer": "dataWeb · Multi-omics 3D genome browser",
  "site.footer.noUpload": "Public-data viewer only — no personalised data analysis or uploads."
}
```

- [ ] **Step 2: Write zh-CN.json (primary)**

Copy the same keys from en.json, translate values:

```json
{
  "home.hero.title": "浏览多组学三维基因组数据",
  "home.hero.lede": "探索猪和鸡样本级别的 Hi-C 图谱、基因表达峰图、表观修饰峰图、结构变异及三维基因组特征。",
  "home.species.pig.latinName": "猪 (Sus scrofa)",
  "home.species.pig.sampleCount": "样本数",
  "home.species.pig.tissueCount": "组织数",
  "home.species.pig.breedCount": "品种数",
  "home.species.chicken.latinName": "鸡 (Gallus gallus)",
  "home.comparison.tissue.title": "组织间比较",
  "home.comparison.tissue.description": "比较不同器官间的染色质结构和信号轨道。",
  "home.comparison.breed.title": "品种间比较",
  "home.comparison.breed.description": "检查同一物种内不同品种的基因组差异。",
  "home.comparison.cross.title": "正反交比较",
  "home.comparison.cross.description": "对比亲本来源和正反交数据集。",
  "home.comparison.developmental.title": "发育时间点比较",
  "home.comparison.developmental.description": "追踪不同发育时间点的三维基因组特征。",
  "tracks.subtab.rna_seq": "RNA-seq",
  "tracks.subtab.h3k4me3": "H3K4me3",
  "tracks.subtab.h3k27ac": "H3K27ac",
  "tracks.subtab.ab": "AB 指数",
  "tracks.subtab.is": "绝缘分数",
  "tracks.subtab.tad": "TAD 边界",
  "tracks.subtab.pei": "PEI 锚点",
  "tracks.subtab.loop": "CTCF 环",
  "tracks.subtab.sv": "结构变异",
  "tracks.subtab.gene": "基因模型",
  "tracks.samplePicker.title": "添加样本",
  "tracks.samplePicker.noSelection": "未选择样本",
  "hic.viewer.title": "Hi-C 接触矩阵",
  "differential.viewer.title": "差异 Hi-C (log2 A / B)",
  "3d.viewer.title": "三维染色质折叠",
  "ctcf.viewer.title": "CTCF 基序（活跃区）",
  "common.loading": "加载中…",
  "common.error": "错误",
  "common.share": "分享",
  "common.downloadPng": "下载 PNG",
  "common.downloadCsv": "下载 CSV",
  "common.search": "搜索",
  "common.region": "区域",
  "common.sampleId": "样本编号",
  "common.species": "物种",
  "common.switchTo.en": "EN",
  "common.switchTo.zh-CN": "中文",
  "site.title": "dataWeb — 多组学三维基因组浏览器",
  "site.footer.disclaimer": "dataWeb · 多组学三维基因组浏览器",
  "site.footer.noUpload": "仅限公开数据浏览 — 不支持个性化数据分析或上传。"
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/zh-CN.json
git commit -m "feat(i18n): add en.json + zh-CN.json translation dictionaries (~60 keys)"
```

---

### Task 6: I18nToggle component

**Files:**
- Create: `apps/web/src/i18n/components/I18nToggle.tsx`
- Create: `apps/web/src/i18n/components/I18nToggle.css`

**Interfaces:**
- Consumes: `useAppDispatch`, `useAppSelector` from `store/index.ts`; `setLocale`, `locale` from slice; `useSearchParams` from react-router-dom
- Produces: rendered segmented control in TopBar

- [ ] **Step 1: Write I18nToggle.css**

```css
.i18n-toggle {
  display: flex;
  padding: 3px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-right: 6px;
}

.i18n-toggle button {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--sans);
  transition: color 0.12s, background 0.12s;
}

.i18n-toggle button.active {
  color: white;
  background: var(--accent);
  box-shadow: 0 1px 3px rgba(143, 45, 36, 0.16);
}
```

- [ ] **Step 2: Write I18nToggle.tsx**

```tsx
import { type JSX } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store';
import { setLocale, type Locale } from '../../store/i18nSlice';
import './I18nToggle.css';

export function I18nToggle(): JSX.Element {
  const dispatch = useAppDispatch();
  const locale = useAppSelector((s) => s.i18n.locale);
  const [, setParams] = useSearchParams();

  const toggle = (next: Locale) => {
    dispatch(setLocale(next));
    setParams(
      (prev) => {
        prev.set('lang', next);
        return prev;
      },
      { replace: true },
    );
  };

  return (
    <div className="i18n-toggle" role="tablist" aria-label="Language">
      <button
        role="tab"
        aria-selected={locale === 'en'}
        className={locale === 'en' ? 'active' : ''}
        onClick={() => toggle('en')}
      >
        EN
      </button>
      <button
        role="tab"
        aria-selected={locale === 'zh-CN'}
        className={locale === 'zh-CN' ? 'active' : ''}
        onClick={() => toggle('zh-CN')}
      >
        中文
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/components/I18nToggle.tsx apps/web/src/i18n/components/I18nToggle.css
git commit -m "feat(i18n): add I18nToggle segmented control component"
```

---

### Task 7: Wire I18nToggle into TopBar

**Files:**
- Modify: `apps/web/src/components/shell/TopBar.tsx`

- [ ] **Step 1: Edit TopBar.tsx**

At top of file:
```ts
import { I18nToggle } from '../../i18n/components/I18nToggle';
```

Inside the return block, insert `<I18nToggle />` just before the `<div className="species-toggle">` (the existing species group). The exact location depends on current markup:

```tsx
<header className="topbar">
  <div className="topbar__brand">dataWeb</div>
  <nav>…</nav>
  {/* NEW: i18n toggle */}
  <I18nToggle />
  {/* Existing species toggle */}
  <div className="species-toggle">…</div>
</header>
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/shell/TopBar.tsx
git commit -m "feat(i18n): add I18nToggle to TopBar before species toggle"
```

---

### Task 8: useAppIntl hook (convenience wrapper)

**Files:**
- Create: `apps/web/src/i18n/hooks/useAppIntl.ts`
- Create: `apps/web/src/i18n/index.ts` (public barrel)

**Interfaces:**
- Consumes: `react-intl.useIntl()` (returns `IntlShape`)
- Produces: `t(id: string, values?: Record<string, unknown>): string` — shorthand

- [ ] **Step 1: Write useAppIntl.ts**

```ts
import { useIntl } from 'react-intl';

/**
 * Convenience wrapper around react-intl's useIntl.
 * Exports `t(id, values?)` shorthand for formatMessage.
 */
export function useAppIntl() {
  const intl = useIntl();
  return {
    intl,
    t: (id: string, values?: Record<string, unknown>): string =>
      intl.formatMessage({ id }, values),
  };
}
```

- [ ] **Step 2: Write i18n/index.ts**

```ts
export { useAppIntl } from './hooks/useAppIntl';
export { I18nToggle } from './components/I18nToggle';
export { detectLocaleFromUrl } from './url/localeFromUrl';
export {
  i18nStore,
  useAppDispatch,
  useAppSelector,
  setLocale,
} from './store';
export type { Locale } from './store/i18nSlice';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dataweb/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/hooks/useAppIntl.ts apps/web/src/i18n/index.ts
git commit -m "feat(i18n): add useAppIntl convenience hook + public barrel export"
```

---

### Task 9: CI lint — i18n:check script + integration

**Files:**
- Modify: `apps/web/package.json` (add `scripts.i18n:check`)
- Create: `scripts/i18n-lint.js` (standalone Node script)

**Interfaces:**
- Consumes: `en.json` keys as the canonical set
- Produces: non-zero exit if any `formatMessage({id: '...'})` call uses a key not in en.json

- [ ] **Step 1: Write scripts/i18n-lint.js**

```js
/**
 * i18n:check — lint that every formatMessage({id: '...'}) static call
 * has a corresponding key in en.json.
 *
 * Dynamic id calls (template strings, variables) are NOT caught by this
 * static grep — the dev-mode react-intl onError handler covers those.
 *
 * Usage: node scripts/i18n-lint.js
 * Exit code 0 = clean; 1 = missing keys found.
 */

const fs = require('fs');
const path = require('path');

const enKeys = new Set(
  Object.keys(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'apps', 'web', 'src', 'i18n', 'messages', 'en.json'),
        'utf-8',
      ),
    ),
  ),
);

// Grep source files for formatMessage({id: '...'}) static calls
const { execSync } = require('child_process');
const result = execSync(
  `find apps/web/src -name '*.ts' -o -name '*.tsx' | xargs grep -ohP "formatMessage\\(\\{id: '[^']+'\\}" 2>/dev/null || true`,
  { encoding: 'utf-8', cwd: path.join(__dirname, '..') },
);

const usedKeys = new Set(
  result
    .split('\n')
    .filter(Boolean)
    .map((line) => line.match(/id: '([^']+)'/)?.[1])
    .filter(Boolean),
);

const missing = [...usedKeys].filter((k) => !enKeys.has(k));
if (missing.length > 0) {
  console.error(`i18n:check — keys used in source but missing from en.json:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n:check — OK (${enKeys.size} keys in en.json, ${usedKeys.size} referenced in source)`);
```

- [ ] **Step 2: Add script to package.json**

In `apps/web/package.json`:
```json
"i18n:check": "node ../../scripts/i18n-lint.js"
```

- [ ] **Step 3: Test it**

```bash
node scripts/i18n-lint.js
```

Expected: `OK` line (0 missing keys).

- [ ] **Step 4: Commit**

```bash
git add scripts/i18n-lint.js apps/web/package.json
git commit -m "ci: add i18n:check lint script for formatMessage key coverage"
```

---

### Task 10: Integration smoke test

**Files:**
- (no new files — manual verification)

- [ ] **Step 1: Build and check for compile errors**

```bash
pnpm --filter @dataweb/web typecheck
pnpm --filter @dataweb/web build
```

- [ ] **Step 2: Dev server manual smoke check**

```bash
pnpm dev
```

Checklist:
- [ ] TopBar shows `EN | 中文` toggle right of nav, left of species toggle
- [ ] Click `中文` → toggle state changes, URL updates to `?lang=zh-CN`
- [ ] Navigate to `/hic?lang=zh-CN` → locale preserved
- [ ] Navigate to `/tracks?lang=zh-CN&type=rna_seq` → locale still zh-CN
- [ ] Refresh on `/hic?lang=zh-CN` → locale persists
- [ ] Open new tab `/hic?lang=en` → locale is English
- [ ] Click `EN` → immediately switches all translated strings
- [ ] Check both dictionaries have same keys (`jq length` on each)
- [ ] Console has no react-intl `MISSING_TRANSLATION` warnings
- [ ] Toggle species (Pig vs Chicken) — i18n locale unchanged (independent concerns)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix: post-i18n integration polish"
```

---

### Task 11 (optional): TopBar CSS adjustment for toggle space

**Files:**
- Modify: `apps/web/src/components/shell/shell.css` (if needed)

Only if the TopBar becomes visually cramped. Wait until after Task 7 manual
verification. If the toggle looks fine, skip this task.

- [ ] **Step: Add gap between I18nToggle and species toggle**

```css
/* Add to .topbar rule or its children */
.topbar {
  gap: var(--space-2);
}
```
