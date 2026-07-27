# ref1 — ModelFactory Pattern

> **核心架构模式**：每个模型自带组件，通过 `<ModelFactory type="..." />` 统一调度，通用渲染基件抽到 `render-kit/`，fail-loud 注册表防止静默失败。

## 起源

2026-07-27 i18n + ModelFactory 重构。19 个 commits，从「巨型 Lane.tsx switch (kind) 怪物」演化而来。

## 核心思想

```
render-kit/              ← 通用 UI primitives（不知道业务）
  plotly/                  ← PlotlyTrack + plotlyTypes + .d.ts
  hic/                     ← HiCMatrix2D + ColormapBar
  plotlyBuilders.ts        ← 通用算法

models/                  ← 业务模型（自带组件，知道一切）
  ModelFactory.tsx         ← <ModelFactory type="hic" />
  ModelSkeleton.tsx        ← type-aware loading placeholder
  MissingModelFallback.tsx ← prod-friendly 降级
  registry.ts              ← Record<ModelType, lazy()>
  types.ts                 ← ModelType 联合
  hic/                     ← HicModel 自带 HiCMatrix + TadBar + GeneLane
  differential/            ← DifferentialModel 自带 Log2Heatmap + GeneLane
  tracks/                  ← TracksModel 自带 9 个 lane + picker UI
  3d/                      ← 3DModel 自带 ThreeDChromatin
  ctcf-motif/              ← CtcfModel 自带 MotifLogo + GenotypePie
```

## 关键决策

### 1. 业务 vs 基础设施分离

| 文件 | 放在哪 | 判别标准 |
|------|------|---------|
| `HiCMatrix2D.tsx` | `render-kit/hic/` | **不知道业务**——接收 `{ matrix, vmin, vmax }` 渲染 canvas。不知道是 hic 还是 differential |
| `HiCMatrix.tsx` | `models/hic/` | **知道业务**——`fetchHicMatrix(sampleId, chr, ...)`、lane 高度、colormap 默认值 |
| `ColormapBar.tsx` | `render-kit/hic/` | 纯 UI 控件，接收 vmin/vmax 渲染刻度 |
| `TadBar.tsx` | `models/hic/` | hic 模型特有的轨道格式、hover 行为 |

**一句话**：render-kit 是「能画图但不知道在画什么」，models 是「知道在画什么但不知道怎么画」。

### 2. 拒绝 `models/shared/`

中途我们尝试过 `models/shared/{hic,linear,stage,tracks}/`，结果：
- 27 个文件被复制到 3 个模型目录（PlotlyTrack × 3、HiCMatrix2D × 3、ColormapBar × 3、plotlyBuilders × 3、HiCMatrix.tsx × 3、...）
- 改 Plotly 样式要改 3 处
- 路由组件命名（hic/HicModel、differential/DifferentialModel、tracks/TracksModel）不一致

**修正**：所有通用渲染基件放 `render-kit/`，模型目录只保留纯业务组件。小规模重复（如 `TadBar.tsx`、GeneLane.tsx`）可以接受。

### 3. fail-loud 注册表

`ModelFactory` 必须区分 dev / prod：

```tsx
if (!Component) {
  if (import.meta.env.DEV) {
    throw new Error(
      `[ModelFactory] Unknown model type: "${type}". ` +
      `Valid types: ${ALL_MODEL_TYPES.join(', ')}. ` +
      `Did you forget to add it to MODEL_REGISTRY?`,
    );
  }
  return <MissingModelFallback type={type} />;
}
```

- **Dev 立即报错**：忘注册直接堆栈，不静默
- **Prod 友好降级**：用户看到 "Model hic not available" 而非空白页

### 4. type-aware Skeleton

不是统一 "Loading..."，按 `type` 渲染对应形状：

```tsx
if (type === '3d') return <div className="model-skeleton" data-type="3d">...</div>;
if (type === 'ctcf-motif') return <div className="model-skeleton" data-type="ctcf-motif">...</div>;
return <div className="model-skeleton" data-type="lanes">...</div>;
```

视觉连续性 + 用户感知模型存在。

## 添加新模型的流程

1. **创建目录**：`components/models/<name>/`
2. **创建入口**：`components/models/<name>/index.tsx`
   ```tsx
   export function <Name>Model(): JSX.Element {
     return (
       <>
         <SomeDataWidget />
         <AnotherWidget />
       </>
     );
   }
   export default <Name>Model;
   ```
3. **注册**：`components/models/registry.ts` 加一行
   ```tsx
   '<name>': lazy(() => import('./<name>')),
   ```
4. **添加类型**：`components/models/types.ts` 加到 `ModelType` 联合
5. **验证**：
   ```bash
   pnpm --filter @dataweb/web typecheck
   ```

## 已知陷阱

- **`render-kit/` 不要塞业务组件**：如果一个组件引用了 `useSampleCatalog` 或 `useViewport`，它属于 models，不属于 render-kit
- **`render-kit/plotly/PlotlyTrack.tsx` 是组件**，`render-kit/plotlyBuilders.ts` 是算法——两者都是通用工具，可以共存
- **CSS 与组件并列**：render-kit 的 CSS 跟组件放同目录（`render-kit/hic/hic.css`），不要全局共享导致样式污染
- **`models/<name>/` 不要有同名子目录**：避免 `models/hic/hic/` 这种嵌套

## 代码片段参考

### `registry.ts` 完整模板

```ts
import { lazy } from 'react';
import type { ComponentType } from 'react';
import type { ModelType } from './types';

export const MODEL_REGISTRY: Record<ModelType, ComponentType> = {
  hic: lazy(() => import('./hic')),
  differential: lazy(() => import('./differential')),
  tracks: lazy(() => import('./tracks')),
  '3d': lazy(() => import('./3d')),
  'ctcf-motif': lazy(() => import('./ctcf-motif')),
};

/** Canonical list, derived from registry keys. */
export const ALL_MODEL_TYPES = Object.keys(MODEL_REGISTRY) as ModelType[];
```

### `types.ts`

```ts
export type ModelType =
  | 'hic'
  | 'differential'
  | 'tracks'
  | '3d'
  | 'ctcf-motif';
```

### `ModelFactory.tsx`

```tsx
import { Suspense, type JSX } from 'react';
import type { ModelType } from './types';
import { MODEL_REGISTRY, ALL_MODEL_TYPES } from './registry';
import { ModelSkeleton } from './ModelSkeleton';
import { MissingModelFallback } from './MissingModelFallback';

interface ModelFactoryProps {
  type: ModelType;
}

export function ModelFactory({ type }: ModelFactoryProps): JSX.Element {
  const Component = MODEL_REGISTRY[type];
  if (!Component) {
    if (import.meta.env.DEV) {
      throw new Error(
        `[ModelFactory] Unknown model type: "${type}". ` +
        `Valid types: ${ALL_MODEL_TYPES.join(', ')}. ` +
        `Did you forget to add it to MODEL_REGISTRY?`,
      );
    }
    return <MissingModelFallback type={type} />;
  }
  return (
    <Suspense fallback={<ModelSkeleton type={type} />}>
      <Component />
    </Suspense>
  );
}
```

### 典型 `models/<name>/index.tsx`

```tsx
import type { JSX } from 'react';
import { useActiveSample } from '../../../hooks/useActiveSample';
import { SomeWidget } from './SomeWidget';
import { AnotherWidget } from './AnotherWidget';

export function <Name>Model(): JSX.Element {
  const sampleId = useActiveSample() ?? 'Brain_BF3';
  return (
    <>
      <SomeWidget sampleId={sampleId} />
      <AnotherWidget sampleId={sampleId} />
    </>
  );
}

export default <Name>Model;
```

## 经验教训

1. **早期避免 `models/shared/`**——重复 27 个文件的代价比清晰边界大得多
2. **`render-kit/` 是真正的"通用层"**——可以被任何模型消费，不需要知道业务
3. **fail-loud 是免费的防御**——一个 if (DEV) throw 省掉无数"为什么是空白页"的调试
4. **Skeleton 应该 type-aware**——一致的视觉跳动对用户感知是"loading 不连续"
5. **`<ModelFactory />` 零 props**——type 字符串足够，不要传其他 prop（避免不同 model 接收不同 prop 的混乱）

## 何时更新本文档

- 新增模型（更新目录约定）
- 调整 `render-kit/` 的边界（业务 vs 基础设施的判别标准变了）
- 改 `ModelFactory` 的接口（增加 fail-safe 行为）
- 沉淀新模式到 ref2/ref3/ref4