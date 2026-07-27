---
name: dataweb-work-flow
description: Use when working on the dataWeb multi-omics genome browser — captures the architectural patterns established during the i18n + ModelFactory refactor (2026-07-27): ModelFactory registry pattern for view models, per-model private components with render-kit extraction, i18n infrastructure (RTK + react-intl + URL ?lang=), route layout template (RouteShell), and home page (A-style landing). Each ref is a self-contained design doc covering one architectural decision.
---

# dataweb-work-flow

dataWeb 项目 (multi-omics 3D genome browser for pigs/chickens) 的架构模式仓库。
**主页面只做 ref 映射**，按需加载详细设计文档。

| ref | 标题 | 简介 | 相对路径 |
|---|---|---|---|
| ref1 | **ModelFactory pattern** | 每个模型自带组件、`<ModelFactory type="hic" />` 统一入口、`render-kit/` 通用基件、`fail-loud` 注册表。**核心架构模式**。 | [[refs/ref1]] |
| ref2 | i18n infrastructure | 静态字典 + RTK i18nSlice + react-intl + URL `?lang=` 单一 source of truth + 两级 fallback。 | [[refs/ref2]] |
| ref3 | RouteShell layout | 跨 viewer 路由通用布局模板：page header + subtitle + actions + region breadcrumb + toolbar slot。 | [[refs/ref3]] |
| ref4 | HomeRoute A-style landing | A 风格 landing page：hero centered + 搜索 + species cards + comparison modes 4 列网格 + 学术克制风格。 | [[refs/ref4]] |

## 何时使用本 skill

任何 dataWeb 的新工作（新增模型、新增路由、新增语言支持、改写主页）开始之前：
- 先打开相关 ref 文档了解既有约定
- 复用对应模式，而不是发明新结构
- 如果发现 ref 与现状不符，更新 ref 让团队保持同步

## 关键约定（项目当前结构）

```
src/
├── components/
│   ├── render-kit/                  ← 通用 UI primitives（业务无关）
│   │   ├── plotly/                   ← PlotlyTrack + plotlyTypes + .d.ts + CSS
│   │   ├── hic/                      ← HiCMatrix2D + ColormapBar + CSS
│   │   └── plotlyBuilders.ts         ← 通用算法
│   ├── models/                       ← 业务模型（自带组件）
│   │   ├── ModelFactory.tsx          ← <ModelFactory type="hic" />
│   │   ├── ModelSkeleton.tsx         ← type-aware loading placeholder
│   │   ├── MissingModelFallback.tsx  ← prod-friendly 降级
│   │   ├── registry.ts               ← Record<ModelType, lazy()>
│   │   ├── types.ts                  ← ModelType 联合
│   │   ├── hic/ + differential/ + tracks/ + 3d/ + ctcf-motif/   ← 每个模型自文件夹
│   ├── shell/                        ← AppShell + TopBar + StatusBar + LeftRail
│   ├── route/                        ← RouteShell 布局模板
│   └── overlay/                      ← d3-zoom 覆盖层 (CrosshairLayer + CTCFLoops)
├── routes/
│   ├── home/                         ← A 风格 landing
│   ├── hic/ + differential/ + tracks/ + 3d/ + ctcf-motif/   ← 路由 index.tsx + registry.ts + trackSpec.ts
└── i18n/                             ← 见 ref2
```

## 关键约定速查

- **新模型**：在 `components/models/<name>/` 加 `index.tsx`（+ 私有组件），然后在 `registry.ts` 加一条 lazy import。**不要**放 `shared/`
- **跨模型共享**：抽到 `render-kit/`。**不**直接放 `models/shared/` 或任何 `models/<x>/` 下
- **新路由**：在 `routes/<name>/index.tsx` 用 `<RouteShell>` 包裹 `<ModelFactory type="..." />`
- **新语言**：在 `i18n/messages/<locale>.json` 加 key，URL `?lang=` 自动选中
- **UI primitives**：纯渲染、不知道业务 → `render-kit/`