# 像素级 Hi-C 多组学查看器 — 实现简报

**目的：** 猪与鸡多组学三维基因组浏览器子代理驱动开发的唯一真相来源。整合 8 张参考截图的视觉分析（docx/refrences/demo{1..8}.png）与架构方案（docx/plan/architecture.md）。

**目标：** Web 应用，渲染交互式 Hi-C 接触图、AB index、IS、TAD 边界、loop 弧线、SV 标记、信号轨道（RNA-seq、H3K4me3、H3K27ac、CTCF、CUT&Tag）、基因模型、3D 染色质折叠模型 — 覆盖猪与鸡 — 在 4 个对比维度（组织 / 品种 / 正反交 / 发育时间点）下。

---

## 1. 参考视觉语法（必须像素级复现）

### 1.1 跨图综合（贯穿 8 张 demo 的重复模式）

**布局 DNA（跨参考图恒定）：**
- 垂直轨道堆叠顺序：**Hi-C 热图 → TAD bar → AB index / LBS 叠加 → loop 弧线带 → ΔIntensity 分割热图 → 信号轨道（RNA-seq、ChIP-seq、CUT&Tag）→ 基因模型 → TPM 表**。
- 正方形 Hi-C 热图，左上三角蒙版白色（数据只在一侧三角显示）。
- 面板标签：粗体大写单字母（A、B、C、D、F、G、I、J、K、L）位于左上。
- 坐标头 "Chr. X: start–end" + 热图顶部刻度条。
- 虚线垂直引导线在堆叠轨道间对齐 x 轴。
- 浅灰阴影矩形高亮差异区域。
- 黑色向下箭头指出特定位点。

**配色 DNA：**
- Hi-C 热图：**RdBu_r 发散**（红高、白中、蓝低），8 张图一致。
- ΔIntensity 热图：**白色居中发散**（橙红正、紫蓝负）。
- AB index：**红色正 / 蓝色负 bar**，零基线。
- TAD bar：纯深灰（#4A4A4A）配浅灰间隔。
- Loop 弧线：浅灰（~#B8B8B8）细贝塞尔曲线。
- 背景：纯白（#FFFFFF）。
- 文字：黑色（#000000）；热图内 RPS 注释为白色文字。

**样本对比配色（语义化，驱动对比设备）：**
| 对比维度 | 样本 A 颜色 | 样本 B 颜色 | 样本 C 颜色 |
|---|---|---|---|
| 性别（demo1、demo4） | ♀ 红 #E74C5C | ♂ 蓝 #2A6FB8 | — |
| 3 时间点（demo2） | E15 红 #E74C5C | D1 绿 #5BA854 | D30 蓝 #3B7DD8 |
| 2 时间点（demo8） | E15 粉/红 #D8504C | D1 绿 #5BA854 | — |
| 猪品种（demo5） | 伯克郡 橙/棕褐 #D88B5A | 藏猪 蓝灰 #B8C8D8 | 杂交 F1 绿 |
| 鸡品种（demo6） | 白羽肉鸡 橙 #E07B5B | 蛋鸡 青 #3A8FB7 | — |
| 组织（demo7） | 肝 红 #D8504C | 肌肉 黄 #D9A93A | 脑 蓝 #3F7CC4 |

**字体 DNA：**
- 全文无衬线（Helvetica/Arial）。
- 基因名斜体（NDN、MAGEL2、MYF6、AKAP9 等）。
- 面板标签粗体大写。
- 序列 motif 与基因 accession 用等宽字体。
- 单一字体族，无展示字体。

### 1.2 每个 demo 的特色元素

| Demo | 特色 | 轨道变体 |
|---|---|---|
| 1 | 性别对比 ♀/♂；脑组织；3Mb 窗口；箭头标注 | AB + LBS + RNA-seq + 基因 + TPM 表 |
| 2 | 3 时间点（E15/D1/D30）；2×2 网格 | AB（3 行）+ RNA-seq（3 行）+ 基因；底排 Hi-C + TAD + LBS |
| 3 | Loop/Promoter-Enhancer 图；**3D ribbon 模型**（紫色） | Hi-C + Promoter/Enhancer 带 + loop 弧线 + 分割 ΔIntensity + 3D 折叠模型 |
| 4 | 性别对比 + 组蛋白修饰；**肝脏组织图标** | Hi-C + loop 弧线 + H3K27ac + H3K4me3 + RNA-seq + 3D 模型 |
| 5 | 猪品种 + **CTCF motif WebLogo** + 饼图（GG/GT/TT） | Motif logo + Hi-C + CTCF（3 行）+ H3K27ac + H3K4me3 + RNA-seq + ΔIntensity |
| 6 | 鸡品种 白羽肉鸡/蛋鸡；**3D 模型** | Hi-C + 分割 ΔIntensity + RNA-seq + 3D 模型 |
| 7 | 3 组织（肝/肌/脑）；**三色配色** | Hi-C + ΔIntensity + H3K27ac + H3K4me3 + RNA-seq（各 3 行）+ 3D 模型 |
| 8 | 2 时间点（E15/D1）；小面板；**3D 模型** | Hi-C + 分割 ΔIntensity + RNA-seq + 基因 + 3D 模型 |

### 1.3 把静态图转为交互式 Web 应用

参考图是 **发表论文图，不是浏览器截图**。要复现：
- 顶栏 / 侧栏 / chrome 样式 **是新增的**，不在参考图中 — 必须设计得不分散视觉。
- 所有参考图面板变成交互式 `<DemoPresetButton>` 槽位。
- 悬停 tooltip、crosshair、点击固定标注：作为附加层叠加在参考美学之上。
- 3D 折叠模型（紫色 ribbon）：用 **Three.js** 渲染（架构原方案是"不用 Three.js" — 见 §7）。装饰性即可，占位几何可接受。

---

## 2. 技术栈（最终，无调研）

| 层 | 选择 | 理由 |
|---|---|---|
| 前端框架 | **React 18 + TypeScript** | Hi-C 浏览器生态标准（HiGlass、JBrowse 2）。 |
| 构建 | **Vite 5** | `vite-plugin-glsl`、HMR 快、ESM 原生。 |
| 状态 | **Zustand**（5 个 store：`viewport`、`samples`、`tracks`、`comparison`、`ui`） | 跨 store 响应式同步；避免 Redux 仪式感。 |
| 元数据获取 | **TanStack Query v5** | 注册 + 物种 + 样本查询。 |
| 区间获取 | **自定义 `useRangeQuery` hook** | 流式二进制，按 `(chr,start,end,bin,track)` 缓存，AbortController。 |
| Hi-C 2D 渲染 | **WebGL2（自定义着色器）** | 一个全屏四边形 + 片段着色器；4Mb 区域每帧 ~2ms。 |
| 线性轨道 | **Canvas 2D** | 4K 上约 12k 像素宽；比 WebGL 简单。 |
| 叠加层（loop、TAD、SV） | **SVG** | 可命中测试、可访问、可导出。 |
| 3D 折叠模型 | **Three.js** | 装饰性；轻量，每个面板的 3–4 个 ribbon 模型刚好。 |
| 后端运行时 | **FastAPI（Python 3.11）+ Uvicorn** | pysam、cooler、bioframe、cooltools、pyBigWig、pytabix 都是 Python 原生。 |
| Hi-C 读取器 | **`cooler`** 处理 `.cool`/`.mcool` | 多分辨率金字塔内置。 |
| Bigwig 读取器 | **`pyBigWig`** | 原生 C，逐碱基 `values()` 查询。 |
| BED/VCF 读取器 | **`pytabix`** + `pysam.TabixFile` | 索引化区间查询。 |
| 缓存 | **两层 LRU** 进程内 + 可选 Redis | 单进程 v1 足够。 |
| 二进制传输 | **`application/octet-stream` + `X-Genomics-Dtype` + `X-Genomics-Shape` 头** | 避免 base64 膨胀。 |

**注：** 架构原方案建议"不用 Three.js"。3D 折叠模型是装饰性的 — Three.js 是每个面板渲染 3–10 个 ribbon 模型最高效的方式。最小化使用（不要 Three.js 控件、不要高级功能）。

---

## 3. Hi-C 性能策略

### 分辨率金字塔
- 存储：`.mcool`，分辨率 {1Mb, 250kb, 100kb, 50kb, 25kb, 10kb, 5kb} 每样本。
- 后端选最小 zoom level：`bin <= requested_bin` 且 `(end-start)/bin <= 1024`（像素上限）。
- 返回：`{dtype, shape, vmin, vmax, transform, data}` — 服务端序列化前应用 `log1p` 与 99 百分位截断。

### WebGL 着色器逻辑
```glsl
uniform sampler2D u_matrix;        // R32F 纹理，已 log1p
uniform float u_vmin, u_vmax;
uniform int   u_colorMap;          // 0=Jet, 1=Viridis, 2=Magma

void main() {
  float v = texture2D(u_matrix, gl_FragCoord.xy / canvasSize).r;
  float t = clamp((v - u_vmin) / (u_vmax - u_vmin), 0.0, 1.0);
  vec3 rgb;
  if (u_colorMap == 0)       rgb = jet(t);
  else if (u_colorMap == 1)  rgb = viridis(t);
  else if (u_colorMap == 2)  rgb = magma(t);
  gl_FragColor = vec4(rgb, 1.0);
}
```

### 坐标系
- 内部统一用基因组 bp。
- 像素：`px = (bp - viewStart) / bin`。
- DPR 正确处理：`canvas.width = clientW * devicePixelRatio`。
- 亚 bin 插值在片段着色器中完成。

---

## 4. 多轨道架构

### 4.1 统一 TrackProps 接口
```ts
interface TrackProps<V = unknown> {
  id: string;
  viewport: Viewport;          // {chr, start, end, bin}
  height: number;              // px
  data: V;                     // 区间查询结果
  scale?: ScaleConfig;         // auto | shared | fixed
  onHover?: (e: HoverEvent) => void;
  exportFormat: 'png' | 'svg';
}
```

### 4.2 轨道类型（全部需支持每 demo 预设布局）

| 轨道 | 渲染器 | 数据 | 默认高度 |
|---|---|---|---|
| Hi-C 2D 热图 | WebGL canvas | `MatrixResponse` | 480px（可配） |
| 基因模型 | Canvas 2D | `gene.BedResponse` | 80px |
| Bigwig（RNA-seq、ChIP-seq、CUT&Tag） | Canvas 2D | `BigwigResponse` | 48px |
| AB index | Canvas 2D | `bedGraphResponse` | 36px（发散配色） |
| IS（绝缘分数） | Canvas 2D | `bedGraphResponse` | 36px |
| TAD 边界 | Canvas 2D + SVG 叠加 | `bed` | 28px |
| Loop arc | SVG 叠加 | `bedpe` | 70px |
| SV | SVG 叠加 | `vcf` | 36px |
| CTCF motif（仅猪） | SVG 叠加 | `bed` | 36px |
| PEI anchor | Canvas 2D | `bed` | 28px |
| ΔIntensity 分割热图 | WebGL canvas | 计算的 log2(A/B) | 480px |
| 3D 折叠模型 | Three.js | 静态几何 | 200px（装饰性） |

### 4.3 同步视口
- 单个 `viewport` store（Zustand）。
- 线性轨道订阅 1D 位置。
- Hi-C 矩阵自有 `window2D = {chr, start, end}`（2D 矩形缩放）。
- 悬停事件发布到 `hoverBus`；Hi-C 中 `bp=x` 行显示半透明 crosshair。

---

## 5. 对比模式架构

对比是 **组合，不是特性分支**。所有对比维度复用相同组件，仅 `samples[]` 不同。

### 布局策略
1. **堆叠热图（上下）：** 2 个 Hi-C lane，同视口，8px 接缝。用于组织、品种、正反交。
2. **ΔIntensity 热图：** 第三个 Hi-C lane 通过 `log2((A+ε)/(B+ε))` 组合，发散 `RdBu_r` 居中于 0。
3. **镜像 bigwig：** A 在轴上方画，B 在下方画。用于 RNA-seq / ChIP-seq / CUT&Tag。
4. **AB compartment 偏移叠加：** 样本 A 与 B 符号不一致区域用半透明黄色高亮。
5. **TAD 边界保守性叠加：** ±10kb 内匹配的边界画细；未匹配标记。

### 每个对比的语义默认
| 对比 | 默认 lane |
|---|---|
| 组织（组织间） | Hi-C 堆叠 + RNA-seq 镜像 + AB 偏移叠加 |
| 品种（品种间） | Hi-C 堆叠 + AB 偏移叠加 + ΔIntensity（可选） |
| 正反交（正反交间） | Hi-C 堆叠 + SV 堆叠 + AB 偏移叠加 |
| 发育时间（仅鸡） | Hi-C 堆叠 + RNA-seq 镜像 + IS 叠加 |

---

## 6. 后端接口与数据文件

### 文件布局
```
data/
  pig-susScr11/
    hic/{sample}.mcool              # 分辨率 1Mb…5kb
    ab_index/{sample}.bedGraph.gz + .tbi
    is/{sample}.bedGraph.gz + .tbi
    tad/{sample}.bed.gz + .tbi
    loops/{sample}.bedpe.gz + .tbi
    pei/{sample}.bed.gz + .tbi
    rna_seq/{sample}.bw
    chip_seq/{sample}_{mark}.bw     # H3K4me3、H3K27ac、CTCF
    ctcf_loops/{sample}.bedpe.gz + .tbi
    sv/{sample}.vcf.gz + .tbi
    genes/Sus_scrofa.gff3.gz + .tbi
  chicken-GRCg7b/
    hic/{sample}.mcool              # 无 CTCF 轨道
    cut_tag/{sample}_{mark}.bw      # CUT&Tag 替代 ChIP-seq
    ...
    genes/Gallus_gallus.gff3.gz + .tbi
  registry.yaml                     # sample → files, breed, tissue, dev_stage, parent_origin
```

### 接口清单
| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/species` | `[{id, assembly, chromosomes}]` |
| GET | `/api/species/{species}/samples` | 过滤后的样本注册 |
| GET | `/api/species/{species}/assembly` | 组装元数据 + cytoband |
| POST | `/api/range` | 多轨道一次性区间查询 |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=&transform=` | 二进制 float32 + vmin/vmax |
| GET | `/api/bigwig/values?file=&chr=&start=&end=&bins=` | 二进制 float32 |
| GET | `/api/bed/overlap?file=&chr=&start=&end=` | JSON 数组 |
| GET | `/api/gene/search?q=` | 基因名 → 区域列表 |
| GET | `/api/gene/region?gene=&expand=` | "跳转到基因" 的区域 |

---

## 7. 像素级复现机制

### 7.1 设计令牌（CSS 自定义属性）
```css
:root {
  /* surface */
  --color-bg: #ffffff;
  --color-surface-1: #fafafa;
  --color-surface-2: #f0f0f0;
  --color-border: #e5e5e5;
  --color-divider-strong: #c8c8c8;

  /* text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555;
  --color-text-tertiary: #888;
  --color-text-on-accent: #fff;

  /* accent */
  --color-accent: #c0392b;
  --color-accent-soft: #e6c8c4;

  /* 生物学专用 */
  --color-a-compartment: #c0392b;
  --color-b-compartment: #2c5fa6;
  --color-tad-boundary: #1a1a1a;
  --color-tad-body: #f5f5f5;
  --color-loop-arc: #b8b8b8;
  --color-loop-arc-highlight: #c0392b;
  --color-sv-del: #b5305d;
  --color-sv-dup: #2e8b57;
  --color-sv-inv: #6e4ca0;
  --color-sv-tra: #444444;
  --color-ctcf-plus: #2c5fa6;
  --color-ctcf-minus: #c0392b;
  --color-pei-anchor: #d4a017;

  /* 样本对比调色板（按对比覆盖） */
  --sample-a: var(--color-a-compartment);
  --sample-b: var(--color-b-compartment);
  --sample-c: #5BA854;

  /* 字体 */
  --font-ui: "Inter", "Helvetica Neue", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Menlo", monospace;
  --font-size-tiny: 11px;
  --font-size-small: 12px;
  --font-size-body: 13px;
  --font-size-label: 13px;
  --font-size-title: 16px;

  /* 间距 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;

  /* 轨道布局 */
  --label-gutter-width: 120px;
  --track-separator: 1px;
  --track-pad-y: 4px;
  --track-pad-x: 8px;

  /* 尺寸 */
  --track-height-bigwig: 48px;
  --track-height-bedgraph: 36px;
  --track-height-tad: 28px;
  --track-height-gene: 80px;
  --track-height-loop: 70px;
  --track-height-matrix: 480px;
}
```

### 7.2 每个 demo 的预设（像素级可复现的核心）
对每个 demo `n ∈ {1..8}`：
- `config/themes/demo{n}.css` — 仅令牌覆盖（与 `:root` 的差量）。
- `config/layouts/demo{n}.yaml` — 确切轨道列表、高度、样本对、区域。
- `<DemoPresetButton n={i}>` 同时加载两者 → 视图匹配参考 PNG。

### 7.3 像素差分 CI
- Playwright 在 `{1920×1080, 2560×1440, 1280×800}` 视口下对每个预设截图，对照 `docx/refrences/demo{n}.png`。
- pixelmatch 阈值 0.05 颜色容差。
- 仅字体抗锯齿变化是预期失败。

---

## 8. UI 组件清单

| 组件 | 作用 |
|---|---|
| `<AppShell>` | 网格：顶栏 / 左栏 / 中央舞台 / 右栏检查器 |
| `<TopBar>` | logo、物种切换器、模式切换器、demo 预设、帮助 |
| `<LeftRail>` | 按品种/组织/发育阶段/亲本来源分组的样本列表 |
| `<RightRailInspector>` | 当前悬停/点击要素的详情 |
| `<ChromosomePicker>` | 列表 + 带 cytoband 着色的 ideogram 条 |
| `<IdeogramSvg>` | 可点击的染色体 |
| `<ZoomSlider>` | 对数刻度；吸附到规范分辨率 |
| `<RegionInput>` | 接受 `chr1:1000000-2000000` 或基因名 |
| `<NavHistoryButtons>` | 后退/前进 |
| `<Breadcrumb>` | chr > 1Mb > 250kb > gene |
| `<Stage>` | 拥有 viewport store；编排 lane |
| `<Lane>` | 标签槽 + 轨道列表，可拖拽调高度 |
| `<HiCMatrix2D>` | WebGL 组件，2D 窗口，crosshair |
| `<LinearTrack>` | 通用 Canvas 2D，按 kind 参数化 |
| `<OverlayTrack>` | loop/TAD/SV/CTCF/PEI 的 SVG 层 |
| `<ComparisonLaneGroup>` | 1–3 个 Hi-C lane（A、B、log2(A/B)）堆叠 |
| `<HoverTooltip>` | 跨轨道悬停弹窗 |
| `<FeatureCallout>` | 持久点击固定要素 |
| `<CrosshairLayer>` | SVG 水平+垂直线 + bp 标签 |
| `<RectSelector>` | 在 Hi-C 上点击拖动 → 2D 下钻 |
| `<BrushZoom>` | shift+拖动 进行精细 2D 选取 |
| `<SampleSelector>` | 主+副样本选择器 |
| `<ComparisonModeSwitch>` | 堆叠 / 镜像 / 仅差异 |
| `<DiffLane>` | 服务端 log2(A/B) 矩阵 |
| `<ConsensusOverlay>` | TAD/loop 保守性层 |
| `<ColormapBar>` | 热图渐变 + 刻度 |
| `<AxisGenomeCoords>` | 中央舞台顶部轴 |
| `<YAxisRuler>` | 每个线性轨道右缘 |
| `<LinearScaleLockButton>` | 在 lane 间切换共享 Y |
| `<ThreeDFoldModel>` | Three.js ribbon + 锚点 |
| `<ExportMenu>` | PNG / SVG / JSON / URL |
| `<SettingsDrawer>` | 配色选择、log 切换、主题 |
| `<KeyboardHints>` | `?` 弹层 |
| `<StatusBar>` | 缩放级别、区域、数据新鲜度 |
| `<DemoPresetButton>` | 加载 demo{n} 主题 + 布局 |

---

## 9. 实施阶段（子代理规模）

每个阶段 = 一个子代理实现者 + 一个任务评审者 + spec/质量门。任何阶段开始前，前一阶段必须有测试 + 人工截图证据。

### Phase 1 — 骨架 + 数据管道
**范围：**
- 仓库脚手架：`apps/web`（Vite+React+TS）、`apps/api`（FastAPI）、`pyproject.toml`、Makefile。
- Mock 数据适配器（`apps/api/app/mock/...`）生成猪与鸡的 Hi-C 矩阵（合成块对角 + 随机 loop）和占位 bedGraph。
- 所有接口对接 mock store 工作。
- 健康检查 + `/docs` 的 OpenAPI。
**完成标准：** `curl /api/hic/matrix?...` 返回二进制 float32 + vmin/vmax；OpenAPI 列出所有接口。

### Phase 2 — 令牌、布局、外壳
**范围：**
- `tokens.css`（上文）+ 字体 + 配色系统。
- `<AppShell>` 网格 + `<TopBar>` + `<LeftRail>`（从 API 读样本列表）。
- 约 12 个猪 + 8 个鸡样本的 mock 注册 JSON。
**完成标准：** `/` 展示带样本列表的样式化外壳。

### Phase 3 — 线性轨道（Canvas 2D）
**范围：**
- `<LinearTrack>` 通用组件，含 `bigwig`、`bedGraph`、`tad-bar`、`gene` 四种 kind。
- `<AxisGenomeCoords>`、`<YAxisRuler>`、跨轨道悬停的 `<HoverTooltip>`。
- DPR + resize 处理。
**完成标准：** 5 个轨道在合成数据上堆叠、同步悬停工作。

### Phase 4 — Hi-C 矩阵（WebGL）
**范围：**
- `<HiCMatrix2D>`：WebGL 初始化、Jet/Viridis/Magma 片段着色器、log 切换、百分位截断。
- 绑定 viewport store；矩形选区 → 2D 下钻；crosshair 叠加。
- `<ColormapBar>`。
**完成标准：** Mock Hi-C 矩阵渲染、log 切换正常、1280×800 上 25kb bin 的 4Mb 区域 60fps 平移/缩放。

### Phase 5 — 叠加层 + 导航
**范围：**
- `<OverlayTrack kind="loop|sv|ctcf|pei" />` SVG 层。
- 点击固定 `<FeatureCallout>`，Esc 清除。
- `<ChromosomePicker>` + `<ZoomSlider>` + `<RegionInput>` 工作。
**完成标准：** Demo 1（"基线单样本视图"）匹配参考 PNG（在像素差分预算内）。

### Phase 6 — 对比模式
**范围：**
- `<SampleSelector>` 主+副、`<ComparisonModeSwitch>`、堆叠布局。
- `<DiffLane>` 处理 log2(A/B)。
- 镜像 bigwig 轨道变体。
- `<ThreeDFoldModel>` Three.js ribbon + 锚点。
**完成标准：** Demo 2、4、6、7、8（对比密集的参考图）匹配。

### Phase 7 — 像素级扫描
**范围：**
- 为全部 8 张参考图创建 `config/themes/demo{1..8}.css` + `config/layouts/demo{1..8}.yaml`。
- `<DemoPresetButton>` 行。
- Playwright pixelmatch CI；差分预算 ≤ 0.5%/图。
- README + ARCHITECTURE 文档；发布横幅。
**完成标准：** 全部 8 张参考图在容差内复现；CI 绿。

---

## 10. 样本数据策略（在真实数据到位前）

确定性 mock 生成器：
- **Hi-C 矩阵：** 对角暖带（对数衰减），合成 TAD 块对角条纹每 ~200kb，稀疏 loop 像素，每 ~5Mb 一段 AB compartment 信号。
- **bigwig / bedGraph：** sin/cos 混合 + 随机位置的 Gaussian 峰。
- **TAD / loop / SV / PEI：** 合成的 bed/bedpe，每条染色体可预测的记录。
- **基因模型：** 静态 fixture（每物种 5–10 个基因）。
- **种子：** `sha256(chr:start:end:bin:sampleId)`，保证可复现。

Mock 后端暴露相同接口；数据源切换只需一个环境变量。

---

## 11. 风险与决策

| # | 主题 | 决策 |
|---|---|---|
| 1 | 配色可访问性 | Hi-C 与 AB 默认 **Viridis**（色盲安全）；Jet 作为可选，带警告。AB 用 `RdBu`（发散、可访问）。状态栏显示当前调色板名。 |
| 2 | 移动 vs 桌面 | **v1 仅桌面**（≥ 1280px）。以下显示回退提示。 |
| 3 | 浏览器下限 | Chrome 110+、Edge 110+、Firefox 120+、Safari 16.4+。WebGL2 + ES2022。 |
| 4 | 性能 | 集成显卡上 5Mb 区域 25kb bin（200×200 矩阵）60fps 平移/缩放。 |
| 5 | 5kb 分辨率 | 存储并渲染；用户下钻到 10kb bin 以下时使用。高缩放慢时警告。 |
| 6 | 鸡的 CTCF | UI 通过物种感知轨道注册隐藏鸡的 CTCF 行。 |
| 7 | 服务端二进制 | `application/octet-stream` + `X-Genomics-Dtype` + `X-Genomics-Shape` 头。 |
| 8 | 多样本扇出 | ≤4 lane 并行 `Promise.all`；8 lane 以上 Grid 模式。 |
| 9 | 真实数据交接 | Mock 返回相同 shape；切换是环境变量。 |
| 10 | 鉴权 | v1 不在范围；如需要走反向代理 + cookie。 |

---

## 12. 验收标准

满足以下条件即视为完成：
1. 全部 8 张参考截图通过 `<DemoPresetButton>` 在 0.5% 像素差分容差内可复现。
2. 每个对比维度（组织 / 品种 / 正反交 / 发育时间）支持堆叠 + 镜像 + ΔIntensity 布局。
3. 集成显卡上 5Mb 区域 25kb bin 60fps 平移/缩放。
4. Mock 数据可通过单个环境变量切换为真实数据。
5. CI：TypeScript strict、ESLint 干净、Vitest + Playwright 像素差分绿。

---

## 13. 文件布局目标

```
dataWeb/
├─ apps/
│  ├─ web/                              # Vite + React + TS
│  │  ├─ src/
│  │  │  ├─ components/
│  │  │  │  ├─ shell/  (AppShell, TopBar, LeftRail, Inspector)
│  │  │  │  ├─ nav/    (ChromosomePicker, Ideogram, ZoomSlider, RegionInput, Breadcrumb)
│  │  │  │  ├─ stage/  (Stage, Lane, ComparisonLaneGroup)
│  │  │  │  ├─ hic/    (HiCMatrix2D, ColormapBar, DiffLane)
│  │  │  │  ├─ linear/ (LinearTrack + kinds)
│  │  │  │  ├─ overlay/(OverlayTrack, LoopOverlay, SVOverlay, CTCFOverlay)
│  │  │  │  ├─ compare/(SampleSelector, ComparisonModeSwitch, ConsensusOverlay)
│  │  │  │  ├─ hover/  (HoverTooltip, FeatureCallout, CrosshairLayer, RectSelector)
│  │  │  │  ├─ threed/ (ThreeDFoldModel)
│  │  │  │  ├─ export/ (ExportMenu, CaptureCanvasPipeline)
│  │  │  │  └─ settings/(SettingsDrawer, KeyboardHints, DemoPresetButton, StatusBar)
│  │  │  ├─ store/             # zustand stores
│  │  │  ├─ hooks/             # useRangeQuery, useViewportSync
│  │  │  ├─ genomics/          # 纯 coord / colormap / decoder 工具
│  │  │  │   ├─ coords.ts
│  │  │  │   ├─ colormap.ts
│  │  │  │   ├─ decoder.ts
│  │  │  │   └─ hic-shader/{vertex,fragment}.glsl
│  │  │  ├─ styles/
│  │  │  │   ├─ tokens.css
│  │  │  │   ├─ themes/{demo1..demo8}.css
│  │  │  │   └─ reset.css
│  │  │  └─ main.tsx
│  │  └─ vite.config.ts
│  └─ api/
│     ├─ app/
│     │  ├─ main.py            # FastAPI
│     │  ├─ routes/{hic,bigwig,bed,gene,species,samples}.py
│     │  ├─ adapters/{base,mock,real}.py
│     │  ├─ cache.py
│     │  └─ schemas.py
│     ├─ tests/
│     └─ pyproject.toml
├─ config/
│  ├─ trackOrder.default.yaml
│  └─ layouts/demo{1..8}.yaml
├─ data/registry.yaml           # 由 mock 生成；后续接真实数据
├─ docx/
│  ├─ plan/{architecture.md, brief.md}
│  ├─ data/readme.md
│  └─ refrences/demo{1..8}.png
└─ tools/pixelmatch/            # Playwright + pixelmatch 配置
```

---

## 14. 开放问题（Phase 1 前需用户确认）

1. **调色板默认**：Viridis（色盲友好）还是 Jet（与已发表论文一致）？
2. **3D 折叠模型保真度**：装饰性静态几何（便宜）还是从真实接触概率数据驱动（昂贵）？
3. **真实数据交接**：真实 `.mcool` / `.bw` 何时到位？托管在哪里？
4. **中英双语 tooltip**：v1 范围内还是延后？
5. **鉴权**：v1 不做，还是至少反向代理 cookie？
6. **平板支持**：硬性仅桌面还是基础响应式兜底？

回答这些后，派发 Phase 1 子代理。