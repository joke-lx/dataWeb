# ref2 — i18n Infrastructure

> **静态字典 + RTK + react-intl + URL `?lang=` 单一 source of truth**。与现有 zustand store 共存，不修改既有数据模型。

## 起源

2026-07-27 i18n 重构。源于「项目完全没有 i18n」状态，78 条翻译 key，en + zh-CN 双语完整接入。

## 核心架构

```
URL ?lang=zh-CN                ← 单一 source of truth
       │
       ▼
RTK i18nSlice (i18n/locale)     ← 与现有 zustand store 共存
       │
       ▼
react-intl IntlProvider         ← 渲染翻译
  defaultLocale="en"
  messages={currentDict}
       │
       ▼
任意组件: useIntl().formatMessage({id: 'home.hero.title'})
       │
       ▼
I18nToggle 组件 (TopBar 右侧)   ← 触发 setLocale + URL 写入
```

## 关键决策

### 1. 静态字典（无后端）

`apps/web/src/i18n/messages/{en.json,zh-CN.json}` 是**前端唯一来源**。理由：
- 学术/工具站没有运营团队改文案
- 类型安全（key 集合确定）
- git diff 可审计
- CI 可校验（`i18n:check` 扫所有 `formatMessage` 调用 vs `en.json` 缺失）

### 2. RTK vs zustand 共存（用户明确选择）

**用户最初要求 Redux Toolkit**——即使与现有 zustand 风格不一致。尊重用户的明确偏好。

- i18n locale state → RTK i18nSlice
- samples / viewport state → 仍 zustand（不重构）
- 不引入 **第二套** zustand（避免心智负担）

### 3. URL 单一 source of truth

```
缺失 → 读 navigator.language，"zh*" 开头 → zh-CN，否则 en
显式 ?lang=zh-CN|en → 立即生效
切换 toggle → dispatch(setLocale) + 写 URL ({replace: true})
跨路由 → setParams callback 保留 ?lang= 等其他参数
```

**理由**：可分享 / 可书签 / 浏览器后退保留 / 与现有 `?species=` / `?samples=` 同范式。

### 4. 两级 fallback

```
zh-CN 缺失 → en 仍缺失 → key 本身
```

react-intl 的 `defaultLocale="en"` 自动实现。`onError` 在 dev 模式 console.warn，prod 静默。

### 5. 用 Intl API 处理复数 / 日期 / 数字

不做 ICU MessageFormat 语法——JSON 值只是字符串，原生 `Intl.NumberFormat` / `Intl.DateTimeFormat` / `Intl.PluralRules` 直接用。降低复杂度。

## 文件结构

```
apps/web/src/i18n/
├── index.ts              ← barrel 出口
├── url/
│   └── localeFromUrl.ts  ← URL ↔ locale 检测
├── store/
│   ├── i18nSlice.ts      ← RTK slice (locale state)
│   └── index.ts          ← configureStore + useAppDispatch/useAppSelector
├── hooks/
│   └── useAppIntl.ts     ← t(id, values?) shorthand
├── components/
│   ├── I18nToggle.tsx    ← TopBar segmented control
│   └── I18nToggle.css
└── messages/
    ├── en.json           ← fallback 字典
    └── zh-CN.json        ← primary 字典
```

## 添加新翻译的流程

1. **在 en.json 和 zh-CN.json 加 key**（必须两边都有，缺失 fallback 警告）
2. **在组件里** `const { t } = useAppIntl();` 然后 `<div>{t('key.subkey')}</div>`
3. **跑 CI 检查**：`pnpm i18n:check`——若有 `formatMessage({id: '...'})` 引用了 en.json 没有的 key，脚本失败

### 翻译 key 命名约定

```
<scope>.<element>.<role>

home.hero.title
home.species.pig.latinName
tracks.subtab.rna_seq
hic.viewer.title
common.loading
common.share
```

## useAppIntl hook

```tsx
import { useIntl } from 'react-intl';

export function useAppIntl() {
  const intl = useIntl();
  return {
    intl,
    t: (
      id: string,
      valuesOrMsg?: Record<string, string | number | boolean | Date | null | undefined> | string,
      defaultMsg?: string,
    ): string => {
      if (typeof valuesOrMsg === 'string') {
        return intl.formatMessage({ id, defaultMessage: valuesOrMsg });
      }
      if (defaultMsg) {
        return intl.formatMessage({ id, defaultMessage: defaultMsg }, valuesOrMsg);
      }
      return intl.formatMessage({ id }, valuesOrMsg);
    },
  };
}
```

**两参数模式**：`t('tracks.subtab.' + tab.id, tab.label)` —— key 不存在时直接用 fallback 字符串。

## CI Lint（`scripts/i18n-lint.js`）

```js
// 静态 grep 所有 formatMessage({id: '...'}) 调用
// 对比 en.json key 集合
// 缺失 → 退出码 1
```

**覆盖范围**：静态 ID。动态 ID（模板字符串、变量）不在覆盖范围内——这些通过 dev mode 的 `console.warn` 兜底。

## 关键决策的 trade-off

| 决策 | 替代方案 | 选哪个的理由 |
|------|---------|------------|
| 静态字典 | 后端 API 拉取 | 学术项目无运营团队；类型安全优先 |
| RTK + zustand 共存 | 全部迁移 RTK / 全部保持 zustand | 用户明确偏好 |
| URL ?lang= | localStorage | 可分享/可书签 |
| react-intl | 自写薄抽象层 | 行业标准 + react-intl 维护活跃 |
| 不做 lazy load | split by locale | 字典 < 10 KB，懒加载是过度优化 |
| 不做 ICU MessageFormat | 高级语法 | MVP 阶段过度，原生 Intl API 足够 |

## 经验教训

1. **静态 ID grep 容易漏**——动态 ID 需要 `console.warn` 兜底
2. **key 缺失的 fallback**要分别处理（dev warn vs prod 静默）
3. **不引入二级 zustand**——用户已经说了 RTK，就不要偷换
4. **<code>detectLocaleFromUrl</code> 必须是 init-only**——模块顶层调用一次
5. **`IntlProvider` 必须包在最外层**——它在 main.tsx 中包整个 App，不是局部

## 何时更新本文档

- 新增语言（zh-TW、ja 等）→ 扩展 `detectLocaleFromUrl` 逻辑
- 改用后端 API（如果以后运营需要）→ 推翻 #1 决策
- 改 store 选型（如果用户改主意 RTK）→ 推翻 #2 决策