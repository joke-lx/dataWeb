# ref4 — HomeRoute A-style Landing

> **A 风格 landing page**——居中 hero + 搜索框 + species cards + comparison modes 4 列网格。学术 / 工具站风格（不浮夸）。

## 起源

用户从 `docx/data/readme.md` 的需求出发，要求「不进行个性化数据分析」的公开数据浏览器。三个 mock（A / B / C）方案中选了 A——hero centered + 学术克制风格。

## 布局结构

```
┌─────────────────────────────────────────────────────────┐
│ TopBar (dataWeb | Hi-C Δ Hi-C Tracks 3D CTCF Motif)    │
│                                              EN | 中文   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  HERO (min-height: 55vh, grid-pattern background)       │
│  ┌─────────────────────────────────────────────────┐    │
│  │ —— PUBLIC MULTI-OMICS ATLAS                      │    │
│  │                                                   │    │
│  │ Browse multi-omics 3D genome data                │    │
│  │ Explore sample-level Hi-C maps...               │    │
│  │                                                   │    │
│  │ [🔍  Enter sample ID  ] [Pig ▾] [Search]        │    │
│  │ Try: Brain_BF3  Liver_BF3  Muscle_BF3  L9876    │    │
│  │                                                   │    │
│  │ ▦Hi-C  ΔΔ Hi-C  ≋Tracks  ◇3D  ⌁CTCF Motif      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  BROWSE BY SPECIES                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐    │
│  │ Sus scrofa            │  │ Gallus gallus         │    │
│  │ Pig                   │  │ Chicken               │    │
│  │ Hi-C, RNA-seq...     │  │ Hi-C, RNA-seq...      │    │
│  │ [Browse →]            │  │ [Browse →]            │    │
│  │                       │  │                       │    │
│  │ ┌──┬──┬──┐            │  │ ┌──┬──┬──┐            │    │
│  │ │ 6│ 4│ 2│            │  │ │TBD│ —│ —│          │    │
│  │ └──┴──┴──┘            │  │ └──┴──┴──┘            │    │
│  │ samples tissues breeds│  │                       │    │
│  └──────────────────────┘  └──────────────────────┘    │
│                                                          │
│  COMPARISON MODES                                       │
│  ┌────────┬────────┬────────┬────────┐                │
│  │ 01 /   │ 02 /   │ 03 /   │ 04 /   │                │
│  │ TISSUE │ BREED  │ CROSS  │ TIME   │                │
│  │        │        │        │        │                │
│  │ Compare│Inspect │Contrast│Follow  │                │
│  │ tissue │ breeds │reciproc│develop │                │
│  └────────┴────────┴────────┴────────┘                │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ footer: dataWeb · public-data viewer only · no uploads   │
└─────────────────────────────────────────────────────────┘
```

## 关键决策

### 1. Hero 居中 + grid pattern 背景

```css
.home-hero::before {
  background-image:
    linear-gradient(rgba(216, 216, 216, 0.33) 1px, transparent 1px),
    linear-gradient(90deg, rgba(216, 216, 216, 0.33) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
}
```

- 居中：让搜索框成为视觉锚点
- grid pattern：暗示「数据 / 结构」语义
- 底部 mask 渐隐：避免硬边界

### 2. 学术克制风格

参考 `pigome.com` / `3dgenome.fsm.northwestern.edu` / `genocat.tools`：
- ❌ 不要 hero video / auto-play animation
- ❌ 不要 carousel / "what's new" 闪烁条
- ✅ 大留白、衬线标题、单色 accent
- ✅ 明确标注「PUBLIC DATA」-不承诺个性化分析

### 3. Species 卡片 = 简化版详情页

每个 species card 包含：
- 拉丁名 + 中文/英文 + 简单描述
- 3 个 stat tile（samples / tissues / breeds）
- "Browse →" CTA → 跳到 `/hic` 路由（目前最完整的 viewer）

`TBD` 标记让用户清楚「这里还没数据」，比假装填充数字更诚实。

### 4. Comparison Modes 是只读卡片

**不**做成可点击的「点这里跳转」CTA——只是**说明**支持什么比较模式。
理由：
- 当前没有真正的「比较」路由
- 强行做会污染设计
- 写明 modes 让用户知道未来能做

### 5. 响应式断点

| 断点 | 行为 |
|------|------|
| ≥1280px | 完整布局，4 列 modes |
| 850–1279px | modes 4→2 列，cards 单列 |
| 620–849px | nav 收起，cards 单列 |
| <620px | search shell 堆叠（input/select/button 垂直），modes 单列，footer 垂直 |

## 文件

```
apps/web/src/routes/home/
├── index.tsx     ← HomeRoute 组件
└── home.css      ← 布局样式（850/620 断点）
```

## 关键文件 + 函数

### `HomeRoute.tsx` 结构

```tsx
import type { JSX } from 'react';
import { useAppIntl } from '../i18n';
import { ROUTES } from '../registry';

const COMPARISON_MODES = ['tissue', 'breed', 'cross', 'developmental'] as const;

export function HomeRoute(): JSX.Element {
  const { t } = useAppIntl();
  const mainRoutes = ROUTES.filter((r) => r.category === 'main');
  const triggerRoutes = ROUTES.filter((r) => r.category === 'trigger');

  return (
    <main className="home-page">
      <section className="home-hero">...</section>
      <section className="home-section">...</section>  {/* species cards */}
      <section className="home-section">...</section>  {/* comparison modes */}
      <footer className="home-footer">...</footer>
    </main>
  );
}
```

### Navigation glyphs

```ts
const glyphs: Record<string, string> = {
  hic: '▦',
  differential: 'Δ',
  tracks: '≋',
  '3d': '◇',
  'ctcf-motif': '⌁',
};
```

monospace 单色，accent 颜色——视觉锚点不抢戏。

## 路由注册

`apps/web/src/main.tsx`：

```tsx
import { HomeRoute } from './routes/home';

// 注册
<Route path="/" element={<HomeRoute />} />
```

`/` 路径直接渲染 HomeRoute，无 redirect。

## 已知边界

- **搜索框当前是 stub**——`onSubmit={(e) => e.preventDefault()}` 只阻止默认行为，没真正跳转
- **物种卡片的 "Browse →"** 全部跳到 `/hic`——未来应该按物种过滤
- **Comparison Modes 卡片无交互**——纯展示
- **Footer "no personalised analysis"** 是 readme 的中文/英文翻译

## 经验教训

1. **选 A 不是为了"好看"**——是为了让搜索成为视觉中心
2. **学术风格 = 留白 + 衬线 + 单色**，**不**= 灰色 + 表格
3. **"TBD" 比假装完整好**——让用户清楚数据状态
4. **monospace 字母 glyph 适合导航图标**——视觉上不抢戏，与 Inter 主字体对比
5. **响应式 4 个断点**比 2 个断点体验更好

## 何时更新本文档

- 搜索框接入真实路由（替换 preventDefault）
- Species 卡片改按物种过滤
- Comparison modes 加交互（弹出选择器）
- 主页新增模块（如"最近更新" / "数据集版本"）