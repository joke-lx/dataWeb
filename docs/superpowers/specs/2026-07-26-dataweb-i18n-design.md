# dataWeb i18n Design

## Background

Add Chinese / English toggle (zh-CN / en) to the dataWeb multi-omics genome
browser. No backend changes — all translations are frontend static dictionaries.

## User Preferences

- **翻译来源**: 前端静态字典 (en.json + zh-CN.json)
- **切换 UX**: TopBar 右侧 segmented control, 与 species toggle 并排
- **状态管理**: Redux Toolkit slice 专门管 i18n locale; 其余现有 zustand store 保持共存
- **Locale source of truth**: URL `?lang=zh-CN | en`(single source of truth)
- **缺失 fallback**: 两级: 当前 locale → en → key 本身
- **复数/数字/日期**: 原生 Intl API (Intl.NumberFormat, Intl.DateTimeFormat, Intl.PluralRules)
- **Lint**: CI 扫所有 `formatMessage({id: ...})` 调用对比 en.json 缺失 key

## 1. Architecture

```
URL ?lang=zh-CN
       │ (initial read + writes back)
       ▼
Redux Toolkit slice: i18nSlice
  state: { locale: 'zh-CN' | 'en' }
  actions: setLocale
  ─ reads/writes URL via middleware or component effect
       │
       ▼
react-intl IntlProvider
  locale={i18nSlice.locale}
  messages={messages[locale]}
  defaultLocale="en"
  fallback
       │
       ▼
任意组件: const intl = useIntl();
         intl.formatMessage({id: 'home.hero.title'})
```

**新增依赖**: `@reduxjs/toolkit` + `react-redux` + `react-intl` + `@formatjs/intl`

**不动**: 所有现有 zustand store.

## 2. File Structure

```
apps/web/src/
├── i18n/
│   ├── index.ts                 ← configureI18nStore()
│   ├── store/
│   │   ├── i18nSlice.ts         ← RTK slice (locale + messages state)
│   │   └── index.ts             ← configureStore() + Provider
│   ├── messages/
│   │   ├── en.json              ← English (fallback)
│   │   └── zh-CN.json           ← Simplified Chinese
│   ├── hooks/
│   │   └── useAppIntl.ts        ← wrape react-intl useIntl()
│   ├── components/
│   │   ├── I18nToggle.tsx       ← TopBar右侧segmented control
│   │   └── I18nToggle.css
│   └── url/
│       └── localeFromUrl.ts     ← URL ↔ locale sync
```

## 3. Translation Key Convention

```
<scope>.<element>.<role>

home.hero.title           — H1
home.hero.lede            — hero subtitle
home.species.pig.latinName
home.species.pig.sampleCount
home.species.pig.tissueCount
home.comparison.tissue.title
home.comparison.tissue.description

tracks.subtab.rna_seq
tracks.subtab.h3k4me3
tracks.subtab.h3k27ac
tracks.subtab.ab
tracks.subtab.is
tracks.subtab.tad
tracks.subtab.pei
tracks.subtab.loop
tracks.subtab.sv
tracks.subtab.gene

tracks.lane.sampleCount
tracks.samplePicker.title
tracks.samplePicker.noSelection
tracks.samplePicker.addSample

hic.viewer.title
hic.toolbar.colormap    — colormap selector label
hic.toolbar.bin
hic.status.contacts
hic.status.loading

differential.viewer.title
differential.slot.sampleA
differential.slot.sampleB
differential.toolbar.modeTissue
differential.toolbar.modeBreed
differential.toolbar.modeCross
differential.toolbar.modeDevelop

3d.viewer.title
3d.canvas.organ.liver
3d.canvas.organ.muscle
3d.canvas.organ.brain
3d.panel.resetCamera
3d.panel.expand

ctcf.viewer.title
ctcf.toolbar.population
ctcf.toolbar.populationGlobal
ctcf.toolbar.populationBerkshire
ctcf.toolbar.populationTibetan
ctcf.toolbar.populationF1
ctcf.snp.tableLabel
ctcf.snp.consensus

common.loading
common.error
common.share
common.downloadPng
common.downloadCsv
common.search
common.region
common.sampleId
common.bin
common.species
common.switchTo.en
common.switchTo.zh-CN

site.title                           — <title>
site.footer.disclaimer
site.footer.reference
site.footer.publicDataNotice
site.footer.noUpload
```

## 4. Key Behaviors

### 4.1 Locale Detection (first visit)

```
1. Read ?lang= from URL
2. If absent, read navigator.language / navigator.languages
3. If match starts-with "zh" → zh-CN; else → en
4. If neither resolves → en
```

### 4.2 Toggle Locale

Click I18nToggle (segmented control: `EN | 中文`):
- dispatch(setLocale(newLocale))
- URL updated: `setParams((prev) => { prev.set('lang', newLocale); return prev; }, { replace: true })`
- IntlProvider receives new messages
- All useIntl() consumers re-render with new locale

### 4.3 Cross-route Persistence

`?lang=` in URL is the single source of truth. Existing `setParams` callback
form (`(prev) => { ... return prev }`) preserves `lang=` alongside all other
params on every route change.

### 4.4 Fallback Behavior

react-intl `IntlProvider` configured with:
- messages from current locale
- `defaultLocale="en"`
- `onError` handler: if key not found in either zh-CN or en → console.warn with key path (dev only); silent in prod

## 5. Testing

| Layer | What | How |
|-------|------|-----|
| Unit | i18nSlice reducer | RTK standard |
| Component | I18nToggle click → URL change | React Testing Library + URL spy |
| Component | useAppIntl returns correct string per locale | render with Provider |
| Integration | All routes re-render in zh-CN | Manual E2E |
| CI | Lint missing en keys | Script: grep all `formatMessage({id: '...'})` → find `en.json` missing → fail if >0 |

## 6. Rollback

Delete `apps/web/src/i18n/`, remove `<IntlProvider>` from `main.tsx`,
remove `<I18nToggle>` from `TopBar.tsx`, uninstall 4 new deps.
No other code is touched.

## 7. Out of Scope (YAGNI)

- Lazy loading translation files (250 KB+ dictionaries would require this; 10 KB does not)
- Translation contribution UI / CMS
- Pseudo-locale (`en_XA`)
- RTL layout (Chinese and English are both LTR)
- SSR / static generation (the app is 100% CSR)
- Migration of existing zustand stores to RTK

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Bundle bloat +45 KB (+12 KB gzip) | Acceptable for v1 |
| RTK / zustand coexistence confusion | README + CLAUDE.md annotation at top of i18n directory |
| Missing translation key in zh-CN but not in en | CI lint catches reverse direction; onError console.warn catches forward direction |
| User with Accept-Language = fr/ja/de/etc falls to en | Documented behavior; future-proof by adding locale JSON |
