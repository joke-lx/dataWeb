# ref3 — RouteShell Layout Template

> **跨 viewer 路由的通用布局模板**——region breadcrumb + page header + toolbar + 内容区。所有 viewer 路由都通过 `<RouteShell>` 套 `<ModelFactory>`。

## 起源

2026-07-27 路由重构期间确立。之前 5 个 viewer 路由各自维护 `route-page` + `route-header` + `route-content` 布局，重复且不一致。

## 组件签名

```tsx
interface RouteShellProps {
  /** Main page title (h2). */
  title: string;
  /** Optional subtitle/description below the title. */
  subtitle?: string;
  /** Optional actions shown on the right of the page header. */
  actions?: ReactNode;
  /** Optional toolbar (controls row below page header). */
  toolbar?: ReactNode;
  /** Region breadcrumb override (defaults from viewport). */
  breadcrumb?: string;
  children: ReactNode;
}
```

## 布局结构

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (dataWeb  logo | Hi-C Δ Tracks 3D CTCF  EN|中文) │
├─────────────────────────────────────────────────────────┤
│ route-header                                             │
│  ┌─────────────────────────────────────────────────┐    │
│  │ <h2>title</h2>                  [actions slot] │    │
│  │ <p>subtitle</p>                               │    │
│  │ chr:start-end · bin 10,000 bp   ← region bar   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│ route-toolbar (optional)                                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [left controls]                [right controls] │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│ route-content (children = <ModelFactory type="..." />)   │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │   Model content (Hi-C / Tracks / 3D / etc.)   │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ StatusBar (chr:start-end · ref)                          │
└─────────────────────────────────────────────────────────┘
```

## 使用模式

```tsx
import { RouteShell } from '../../components/route/RouteShell';
import { ModelFactory } from '../../components/models';

export function HicRoute(): JSX.Element {
  const { t } = useAppIntl();
  const viewport = useViewport();
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  const region = `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;

  return (
    <RouteShell
      title={t('hic.viewer.title')}
      subtitle={t('hic.viewer.desc', { sampleId, region })}
    >
      <ModelFactory type="hic" />
    </RouteShell>
  );
}
```

## 与 ModelFactory 的协作

**核心关系**：`RouteShell` 提供外壳，`ModelFactory` 提供内容。两者**完全解耦**——可单独替换或升级。

```tsx
<RouteShell title="..." subtitle="...">  {/* 布局 */}
  <ModelFactory type="hic" />           {/* 内容 */}
</RouteShell>
```

`ModelFactory` 内部 lazy + Suspense，骨架与 RouteShell 无关——layout 立即可见，model 加载时显示 skeleton。

## 关键决策

### 1. 布局与数据分离

`RouteShell` **不取数据**——title、subtitle、actions、toolbar 都是 props。数据获取在路由文件里（`useActiveSample` / `useViewport`），组装成 props 传给 RouteShell。

**理由**：RouteShell 是纯展示组件，可独立测试；数据获取策略变化不影响 layout。

### 2. region breadcrumb 默认从 viewport 派生

`<RouteShell>` 不接 region prop 时，自动从 `useViewport()` 读取：

```tsx
const region = breadcrumb ?? 
  `${viewport.chr}:${viewport.start.toLocaleString()}-${viewport.end.toLocaleString()}`;
```

`breadcrumb` prop 只在需要覆盖默认行为时使用（如 d3-zoom 拖拽中显示实时坐标）。

### 3. toolbar 是 slot 不是内建组件

`toolbar` 是 `ReactNode`——路由文件可自由组装：

```tsx
<RouteShell
  title="Tracks"
  toolbar={
    <div className="route-toolbar__left">
      <SubTabBar tabs={SUB_TABS} value={tab.id} onChange={handleTabChange} />
    </div>
  }
>
```

避免 RouteShell 内部 import 5 个工具栏组件（变体太多），保持 shell 自身极简。

### 4. i18n 由调用方传入，不在 RouteShell 内调用

`title` 和 `subtitle` 已经是翻译好的字符串——`RouteShell` 不调用 `useAppIntl`。这样 RouteShell 可以脱离 i18n context 单独测试。

## 现有 viewer 路由的 RouteShell 用法

| 路由 | title 来源 | subtitle 来源 | toolbar |
|------|----------|------------|---------|
| `/hic` | `t('hic.viewer.title')` | `t('hic.viewer.desc', {sampleId, region})` | 无 |
| `/differential` | `t('differential.viewer.title')` | `t('differential.viewer.desc', {a, b, region})` | 无 |
| `/tracks` | `t('tracks.subtab.' + tab.id, tab.label)` | sample + region | `<SubTabBar />` |
| `/3d` | `t('3d.viewer.title')` | `t('3d.viewer.desc', {id})` | 无 |
| `/ctcf-motif` | `t('ctcf.viewer.title')` | region | 无 |

## 关键文件

- `apps/web/src/components/route/RouteShell.tsx` — 组件本体
- `apps/web/src/routes/route.css` — 布局样式
- `apps/web/src/routes/<name>/index.tsx` — 调用方（每个路由一个文件）

## 何时更新本文档

- 新增 viewer 路由 → 在「现有路由的 RouteShell 用法」表加一行
- 改 RouteShell 签名（增加 actions slot、新增 region override 等）
- 增加新样式约定（如未来加 sidebar）