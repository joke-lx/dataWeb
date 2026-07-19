# 多组学三维基因组浏览器 — 架构方案

**目标：** 实现像素级复现 8 张参考截图的 Web 应用，覆盖猪与鸡的多组学可视化
**仓库根目录：** `D:\DevProjects\my\work\dataWeb`
**状态：** 新仓库。目前仅有 `docx/`（readme + 8 张参考 PNG + 本方案）。

---

## 0. 设计原则（其他一切决策的基石）

1. **Hi-C 矩阵是骨架。** 所有其他轨道都是线性的，与矩阵的 2D 窗口同步。矩阵用 WebGL 渲染；线性轨道用 Canvas 2D；叠加层（loop、TAD bar）用 SVG 以保持可命中测试。
2. **一切按区间查询。** 后端只暴露区域范围的接口（`?chr&start&end&bin`）。不返回全基因组。这是 5kb 分辨率可行的前提。
3. **对比是组合，不是特殊模式。** 两个样本 = 两个相同的组件堆叠。系统绝不区分"对比 vs 单样本"——只区分布局（上下、左右、叠加）。
4. **像素级 = 设计令牌 + 槽位。** 所有视觉选择放在 CSS 自定义属性里。所有布局选择放在每页的 `TrackConfig[]` 中。不为某个截图写专用代码路径。
5. **两个物种，一套代码。** 物种差异体现在配置上：组装名（`Sscrofa11.1` / `GRCg7b-2024`）、染色体列表、配色、基因名字体。不写物种专用组件。

---

## 1. 技术栈 — 最终决策

### 前端
| 层 | 选择 | 为何选这个而非其他 |
|---|---|---|
| 框架 | **React 18 + TypeScript** | Hi-C 相关工具成熟（HiGlass、JBrowse 2 都是 React-TS 生态）；生信工程师储备最大。Vue/Svelte 缺少活跃项目中的 Canvas/WebGL 范式。 |
| 构建 | **Vite 5** | `vite-plugin-glsl` 支持着色器；Canvas 调试 HMR 快；ESM 原生。 |
| 状态 | **Zustand**（5 个 store：`viewport`、`samples`、`tracks`、`comparison`、`ui`） | 避免 Redux 仪式感；Zustand 的 slice 模型能干净地处理跨 store 响应式同步（如 viewport 改变 ⇒ 轨道重新查询）。**基因组数据不用 React Query**——见下。 |
| 数据获取 | **TanStack Query v5** 处理样本/注册元数据；**自定义 `useRangeQuery` hook** 处理基因组区间 | Bigwig / Hi-C / bed 响应是流式类型化的，按 `(chr,start,end,bin,track)` 缓存；TanStack Query 不流式二进制区间。自定义 hook 包装带 LRU + AbortController 的类型化 fetch。 |
| 基因组 1D 渲染 | **Canvas 2D** | 4K 屏上 60fps 线性轨道约 12k 像素宽；Canvas 2D 足够，比 WebGL 简单。 |
| Hi-C 2D 渲染 | **WebGL2**（自定义，不用 Three.js） | 只需要一个全屏四边形 + 片段着色器。Three.js 没有收益却增加开销。WebGL2 在 2026 年的桌面浏览器中通用。 |
| 叠加层（loop、TAD bar、SV） | **SVG** | 需要可命中测试元素、可访问标签、可导出为矢量。SVG 叠在 WebGL canvas 上方。 |
| 染色体 ideogram | **SVG** | 30 个元素，数据少，需要清晰文字与悬停。 |
| 基因模型 / GFF | **Canvas 2D**，通过 canvas-pool 懒构建 | 预平铺绘制的字形；每个可见基因区域一个 canvas。 |

### 后端
| 层 | 选择 | 原因 |
|---|---|---|
| API 运行时 | **FastAPI（Python 3.11）+ Uvicorn** | 生信库（`pysam`、`cooler`、`bioframe`、`cooltools`、`pyBigWig`、`pytabix`、`pairtools`）都在 Python。Node 要重写数据加载器。 |
| Hi-C 读取器 | **`cooler`**（`.cool`/`.mcool`）— 通过 zoom level 原生支持多分辨率 | `.hic` 需要 `straw` C++ 或 `hictreetypeconvert`。`.mcool` 是现代标准，免费拿到分辨率金字塔。 |
| Bigwig 读取器 | **`pyBigWig`** | 经实战检验，原生 C 速度，支持 `values("chr", start, end, num_bases)` 快速逐碱基查询。 |
| BED/GFF 读取器 | **`pytabix` + `pysam.TabixFile`** | 用 tabix 索引处理 `AB.bedGraph`、`TAD.bed`、`SV.vcf.gz`、`CTCF_loop.bedpe`。 |
| 任务运行器 | **asyncio** + 阻塞 I/O 线程池（`run_in_executor`） | 不上 Celery — 每会话一个用户，没有扇出。 |
| 缓存 | **两层**：(a) 进程内 `cachetools.LRUCache`，键为 `(file,mtime,chr,start,end,bin)`；(b) **可选 Redis** 跨 Uvicorn worker 共享 | 单进程 v1 足够；Redis 在横向扩展时才有价值。 |
| NumPy / WebGL 桥接 | 以原始 `float32` 数组字节返回（JSON 中 `.data` 字段，或带 XHR 的 `application/octet-stream`） | 避免对 5kb 分辨率 8Mb 区域矩阵做 base64 编码（会变成 ~16MB JSON）。二进制 blob + `dtype/shape` 头。 |

### 开发工具链
- TypeScript strict 模式，CI 中跑 `tsc --noEmit`。
- ESLint（`@typescript-eslint`、`eslint-plugin-react`）、Prettier。
- **Vitest** 单元测试（颜色计算、基因组坐标变换、IS/AB 缩放）。
- **Playwright** 对照 8 张参考 PNG 做截图差分（这是"像素级"真正落地的办法）。
- **Storybook** 组件隔离（`linear/bigwig`、`linear/bed`、`overlay/loop`、`overlay/tad`、`overlay/sv`、`heatmap/hic-2d`）。

---

## 2. Hi-C 性能策略

### 2.1 分辨率金字塔
存储：**`.mcool`**（多分辨率 `.cool`）。每个（样本，组装）一个文件，分辨率 {1Mb, 250kb, 100kb, 50kb, 25kb, 10kb, 5kb}。每个 zoom level 独立的 Cooler。

后端接口：
```
GET /api/hic/matrix?sample={id}&chr={chr}&start={bp}&end={bp}&bin={bp}
```
服务端：选最小 zoom level，满足 `bin <= bin` 参数 且 `(end-start)/bin <= 1024`（canvas 像素上限）。返回 `dtype=float32, shape=[N,N], vmin, vmax, log_applied=true, values=<bytes>`。

客户端根据视口宽度选择 `bin`：
```
bin = max(targetBins, viewerWidthPx)   // 1 像素 = 1 bin（或更粗）
targetBins ~ pixels × 0.5              // DPR 过采样 2×
dprMultiplier = devicePixelRatio       // canvas drawingBuffer
```

### 2.2 为什么 5kb 必须用 WebGL
4Mb 区域 5kb 分辨率 = **800×800 = 640,000 cell**。
- Canvas 2D `putImageData` 在此规模的热图上每帧约 30ms，拖慢交互。
- WebGL 片段着色器只需 **<2ms**，因为只渲染一个四边形，让 GPU 采样约 1024×1024 的 DataTexture（LERP 实现亚 bin 平滑）。

### 2.3 颜色着色器逻辑
上传一次，每个矩阵一份。片段着色器做：

```glsl
uniform sampler2D u_matrix;        // R32F 纹理，已应用 log1p
uniform float u_vmin, u_vmax;      // 百分位截断范围
uniform int  u_colorMap;           // 0=Jet, 1=Viridis, 2=Magma, 3=Custom
uniform float u_dpr;               // 此处未使用，保留备用

float v = texture2D(u_matrix, gl_FragCoord.xy / canvasSize).r;
float t = clamp((v - u_vmin) / (u_vmax - u_vmin), 0.0, 1.0);

vec3 rgb;
if (u_colorMap == 0)       rgb = jet(t);
else if (u_colorMap == 1)  rgb = viridis(t);
else if (u_colorMap == 2)  rgb = magma(t);
gl_FragColor = vec4(rgb, 1.0);
```

**服务端预变换**（节省带宽与客户端计算）：
- `vmin, vmax` 取请求区域的 **99 百分位**接触计数（不用全局最大值 — 会隐藏结构）。
- 序列化前对所有值应用 `log1p`。
- 同时发送 raw + log 字段；客户端可通过 UI 切换，默认 log。

### 2.4 坐标系
- 基因组轴：`bp`。内部统一。
- 像素：`px = (bp - viewStart) / bin`。左上角为整数；亚像素插值在片段着色器中完成，平滑平移。
- 矩阵中的 Hi-C cell `(i,j)`：行 = `(viewStart + i*bin)`，列同理。对角对称，所以只上传 `(end-start)/bin × (end-start)/bin`（除非后续加上三角优化）。

### 2.5 DPR 处理
```ts
const canvas = useRef<HTMLCanvasElement>(null);
useLayoutEffect(() => {
  const c = canvas.current!;
  const dpr = window.devicePixelRatio;
  c.width  = clientW * dpr;   // drawing buffer
  c.height = clientH * dpr;
  c.style.width  = clientW + 'px';
  c.style.height = clientH + 'px';
  gl.viewport(0, 0, c.width, c.height);
}, [clientW, clientH, dpr]);
```
平移/缩放操作 `MatrixRenderTransform` 是单个 `uviewMatrix` uniform；矩阵数据本身不需要每帧 `gl.uniform` 抖动。

---

## 3. 多轨道架构

### 3.1 轨道分类
每个轨道是一个实现统一接口的 React 组件：

```ts
interface TrackProps<V = unknown> {
  id: string;
  viewport: Viewport;                 // {chr, start, end, bin}
  height: number;                     // px
  data: V;                            // 区间查询结果
  scale?: ScaleConfig;                // auto / fixed / shared
  onHover?: (e: HoverEvent) => void;  // 用于 tooltip / crosshair
  exportFormat: 'png' | 'svg';
}
```

| 轨道 | 渲染器 | 数据 | 备注 |
|---|---|---|---|
| Hi-C 2D 热图 | WebGL `<canvas>` | `MatrixResponse` | **核心**元素。2D 平移 + 2D 缩放（矩形选区 → 2D 下钻）。 |
| 基因模型 | Canvas 2D | `gene.BedResponse`（按 bin 级别懒加载） | 外显子 = 实心矩形，内含子 = 细线，转录本末端有链方向箭头。悬停 → 基因名。 |
| Bigwig（RNA-seq、H3K4me3、H3K27ac） | Canvas 2D | `BigwigResponse` | 曲线下填充；默认 Y 自动缩放；可选跨样本共享 Y。 |
| AB index | Canvas 2D | `bedGraphResponse` | 发散配色（红↔蓝），0 线加重。 |
| IS（绝缘分数） | Canvas 2D | `bedGraphResponse` | TAD 边界 = 局部极小值；画曲线 + 在下方 0 标出垂直刻度标记极小值。 |
| TAD 边界 | Canvas 2D + SVG 叠加 | `bed` | 每个 TAD 一根 bar；上边为边界线。 |
| Loop arc | SVG 叠加 | `bedpe` | 每个 loop 一条二次贝塞尔曲线；点击 → 高亮两端锚点。 |
| SV | SVG 叠加 | `vcf` | DEL/DUP 用三角，INV/TRA 用断线。 |
| CTCF motif（仅猪） | SVG 叠加 | `bed` | 位点三角 + 链方向箭头。 |
| PEI anchor | Canvas 2D | `bed` | 锚点中点的粗 bar。 |

### 3.2 布局系统
视图由 **lane（泳道）** 组成。每个泳道包含：
- 固定标签槽（默认 `width = 120px`，用户可调），
- 1px 分隔线在下方，
- 轨道列表（`{id, height}[]`）。

```
+----------+--------------------------------------------------+
| 标签     |   Hi-C 矩阵（WebGL，高度可变）                  |
| 槽       |                                                  |
+----------+--------------------------------------------------+
| label    | Bigwig: RNA-seq (40px)                           |
+----------+--------------------------------------------------+
| label    | Bigwig: H3K4me3 (40px)                           |
+----------+--------------------------------------------------+
| label    | TAD bars (28px)                                  |
+----------+--------------------------------------------------+
| label    | Loop arcs (60px)                                 |
+----------+--------------------------------------------------+
```

### 3.3 同步视口
只有 **一个** `viewport` store。线性轨道通过 Zustand selector 订阅。Hi-C 矩阵自带 `window2D = {chr, start, end}`（同一 1D 位置，但额外跟踪 2D 矩形缩放）。所有线性轨道只同步 1D 窗口。

悬停事件发布到 `hoverBus` store。光标下所有轨道亮起；Hi-C 矩阵中 `bp = x` 行覆盖半透明 crosshair。

### 3.4 Y 轴自动缩放
每个线性轨道有 `scale: { mode: 'auto' | 'shared' | 'fixed', vmin?, vmax? }`。默认 `auto`。在对比模式下，当 `mode === 'shared'` 且 `scaleGroup` id 匹配某祖先 lane 时，多样本共享 Y 缩放。

---

## 4. 对比模式架构

对比是 **布局引擎**，不是独立功能。后端返回相同接口；客户端组合 N 个样本。

### 4.1 三种对比布局（独立决策）
1. **堆叠热图（上下）：** 两个 Hi-C lane，同视口，8px 接缝。用于：组织、品种、正反交。
2. **差异热图（log2 比值）：** 第三个 Hi-C lane 通过 `log2((A+ε)/(B+ε))` 组合两者，发散 `RdBu_r` 居中于 0。可切换。
3. **镜像 bigwig：** A 在轴上方画（`up` 填充），B 在下方画（`down` 镜像填充）。用于：RNA-seq / ChIP-seq / CUT&Tag 并排展示。
4. **AB compartment 偏移叠加：** lane 渲染两个样本的 AB index，两者符号不一致的区域用半透明黄色高亮。
5. **TAD 边界保守性叠加：** lane 显示两个样本的 TAD；±10kb 内的边界匹配后画细；未匹配的标记。

### 4.2 数据流
```
sampleSelector.onChange(S1, S2, mode) →
  comparisonStore.setLayout(mode) →
  TrackRenderer 从 comparisonStore 读取 samples[0], samples[1] →
  并行通过 Promise.all 请求 /api/hic/matrix?sample=S1&... 和 ?sample=S2&...
  组合 lane
```

所有 Hi-C 查询独立。使用 `Promise.all`，总延迟 ≈ 一次查询，而非两次。

### 4.3 语义标记
| 对比维度 | 默认 lane |
|---|---|
| **组织间** | 同品种不同组织。Hi-C 堆叠 + RNA-seq 镜像。 |
| **品种间** | 同组织不同品种。Hi-C 堆叠 + ATAC-seq（如有）+ AB 偏移叠加。 |
| **正反交间** | 同品种组织，亲本来源互换。Hi-C 堆叠（核心发现）+ SV 堆叠 + AB 偏移叠加。 |
| **发育时间点（仅鸡）** | 同品种个体，不同年龄。Hi-C 堆叠 + RNA-seq 镜像 + IS 叠加（TAD 随年龄合并）。 |

---

## 5. 数据文件格式与后端接口

### 5.1 存储布局
```
data/
  pig-susScr11/
    hic/
      liver.mcool                    # 分辨率：1Mb…5kb
      muscle.mcool
      ...
      ab_index/{sample}.bedGraph.gz + .tbi
      is/{sample}.bedGraph.gz + .tbi
      tad/{sample}.bed.gz + .tbi
      loops/{sample}.bedpe.gz + .tbi
      pei/{sample}.bed.gz + .tbi
    rna_seq/{sample}.bw
    chip_seq/{sample}_H3K4me3.bw
    chip_seq/{sample}_H3K27ac.bw
    chip_seq/{sample}_CTCF.bw
    ctcf_loops/{sample}.bedpe.gz + .tbi
    sv/{sample}.vcf.gz + .tbi
    genes/Sus_scrofa.gff3.gz + .tbi
  chicken-GRCg7b/
    hic/... （相同布局，无 CTCF 轨道）
    cut_tag/{sample}_H3K4me3.bw
    cut_tag/{sample}_H3K27ac.bw
    ...
    genes/Gallus_gallus.gff3.gz + .tbi
  registry.yaml                       # sample → files, breed, tissue, dev_stage, parent_origin
```

### 5.2 接口
| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/species` | `[{id:'pig', assembly:'Sscrofa11.1', chromosomes: [...]}, {id:'chicken', ...}]` |
| GET | `/api/species/{species}/samples` | 过滤后的样本注册 |
| GET | `/api/species/{species}/assembly` | 组装元数据 + cytoband |
| POST | `/api/range` | 多轨道一次性：body 列出 `(trackId, sampleId, chr, start, end)`；返回 dict |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=&transform=log\|none` | 二进制 `{dtype, shape, vmin, vmax, transform, data}` |
| GET | `/api/bigwig/values?file=&chr=&start=&end=&bins=` | 二进制 `{dtype, shape, data}` |
| GET | `/api/bed/overlap?file=&chr=&start=&end=` | JSON 数组（TAD / SV / loops / PEI 等） |
| GET | `/api/gene/search?q=` | JSON（基因名 → `(chr,start,end)` 命中列表） |
| GET | `/api/gene/region?gene=&expand=` | JSON 区域（用于"跳转到基因"） |

### 5.3 多分辨率策略
- **Hi-C：** `.mcool` 自带存储分辨率。后端根据 `(end-start)/requested_visual_bins` 选择分辨率。
- **Bigwig：** 原生多分辨率。**一个** `.bw` 文件覆盖所有尺度；无需预切片。
- **BED / bedGraph / VCF：** tabix 索引；区间查询是 O(log n) 的磁盘寻址。

### 5.4 缓存
- L1：进程内 LRUCache(8192)，键为 `(filepath, file_mtime, query_key)`。文件系统 `mtime` 每 60s 轮询以在数据刷新时失效。
- L2（可选）：Redis 跨 Uvicorn worker 共享，同键格式，24h TTL。
- 两层都用 `sha1(filepath + mtime + query)` 作键。
- HTTP 侧：`Cache-Control: private, max-age=86400` + `ETag: sha1(...)` 用于浏览器缓存。

---

## 6. UI 组件清单

### 6.1 应用外壳
- `<AppShell>` — 网格：顶栏 | 左栏 | 中央舞台 | 右栏检查器。
- `<TopBar>` — logo、物种切换器、模式切换器（单样本/对比）、帮助。
- `<LeftRail>` — 按 `breed / tissue / devStage / parentOrigin` 分组的样本列表，按当前物种过滤。
- `<RightRailInspector>` — 可折叠；显示当前悬停/选中要素的详情。

### 6.2 导航
- `<ChromosomePicker>` — 列表 + 带 cytoband 着色的 ideogram 条。
- `<IdeogramSvg>` — 可点击的染色体。
- `<ZoomSlider>` — 对数刻度；吸附到规范分辨率（`1Mb / 250k / 50k / 10k / 5k`）。
- `<RegionInput>` — 接受 `chr1:1000000-2000000` 与基因名跳转。
- `<NavHistoryButtons>` — 访问栈的前进/后退。
- `<Breadcrumb>` — `chr > 1Mb > 250kb > gene`。

### 6.3 舞台
- `<Stage>` — 拥有 viewport store；编排要渲染哪些 lane。
- `<Lane>` — 标签槽 + 轨道列表，可拖拽调高度、可重排。
- `<HiCMatrix2D>` — WebGL 组件，拥有 2D 窗口，渲染中央 crosshair。
- `<LinearTrack>` — 通用 Canvas 2D，按 track-kind 参数化。
  - `<LinearTrack kind="bigwig" />`
  - `<LinearTrack kind="bedGraph" />`（用于 AB、IS）
  - `<LinearTrack kind="tad-bar" />`
  - `<LinearTrack kind="gene" />`
- `<OverlayTrack kind="loop|sv|ctcf|pei" />` — SVG 叠加。
- `<ComparisonLaneGroup>` — 渲染 1–3 个 Hi-C lane（A、B、log2(A/B)）堆叠。

### 6.4 选择与交互
- `<HoverTooltip>` — 任意轨道悬停事件的固定位置弹窗。
- `<FeatureCallout>` — 要素的持久标注（左键单击）；跨平移保留，Esc 移除。
- `<CrosshairLayer>` — WebGL canvas 上方的 SVG 层；水平 + 垂直线，基因组坐标标签。
- `<RectSelector>` — 在 Hi-C 矩阵上点击拖动 → 2D 窗口缩放进入。
- `<BrushZoom>` — shift+拖动 进行精细 2D 选取。

### 6.5 对比与差分
- `<SampleSelector>` — 主样本 + 副样本选择器，切换开关。
- `<ComparisonModeSwitch>` — 单选：堆叠 / 镜像 / 仅差异。
- `<DiffLane>` — 服务端合并 A 与 B 并一次性返回 log2 矩阵。
- `<ConsensusOverlay>` — TAD/loop 保守性层。

### 6.6 图例与坐标轴
- `<ColormapBar>` — 热图、AB、IS 的渐变 + 数字刻度。
- `<AxisGenomeCoords>` — 中央舞台顶部轴；主/次刻度密度随缩放自适应。
- `<YAxisRuler>` — 每个线性轨道右缘，附带"固定"/"自动"小指示。
- `<LinearScaleLockButton>` — 在对比组内跨 lane 切换共享 Y。

### 6.7 导出
- `<ExportMenu>` — `PNG`（仅舞台）、`SVG`（仅叠加层）、`JSON`（可见轨道的原始数据）、`URL`（分享当前视图）。
- `<CaptureCanvasPipeline>` — 以 2× DPR 重新渲染 Hi-C 用于导出，通过 DOM-to-canvas 合成 SVG 叠加层。

### 6.8 设置与其他
- `<SettingsDrawer>` — 配色选择、log/线性切换、主题、抗锯齿开关。
- `<KeyboardHints>` — `?` 弹层。
- `<StatusBar>` — 底部：缩放级别、当前区域、数据新鲜度。

---

## 7. 像素级复现方案

### 7.1 设计令牌（CSS 自定义属性 — 单一来源）

**Light 主题**（默认；匹配 PIGOME / 3D Genome Browser 参考的白色基调）：

```css
:root {
  /* surface */
  --color-bg: #ffffff;
  --color-surface-1: #fafafa;       /* gutter / panel */
  --color-surface-2: #f0f0f0;       /* hover */
  --color-border: #e5e5e5;
  --color-divider-strong: #c8c8c8;

  /* text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #555;
  --color-text-tertiary: #888;
  --color-text-on-accent: #fff;

  /* accent */
  --color-accent: #c0392b;          /* pigome 偏红橙的强调色 */
  --color-accent-soft: #e6c8c4;
  --color-link: #c0392b;
  --color-link-hover: #962d22;

  /* 生物学专用令牌 — 着色器和 canvas 绘制都引用 */
  --color-a-compartment: #c0392b;   /* A compartment 红 */
  --color-b-compartment: #2c5fa6;   /* B compartment 蓝 */
  --color-a-bg:               #fce8e6;
  --color-b-bg:               #e6edf6;
  --color-tad-boundary:       #1a1a1a;
  --color-tad-body:           #f5f5f5;
  --color-loop-arc:           #e0833b;
  --color-loop-arc-highlight: #c0392b;
  --color-sv-del:             #b5305d;
  --color-sv-dup:             #2e8b57;
  --color-sv-inv:             #6e4ca0;
  --color-sv-tra:             #444444;
  --color-ctcf-plus:          #2c5fa6;
  --color-ctcf-minus:         #c0392b;
  --color-pei-anchor:         #d4a017;

  /* 热图调色板为 11-stop 字符串（匹配 ImageData 调色板查询） */
  --cmap-jet-stops:    /* blue → cyan → green → yellow → red */;
  --cmap-viridis-stops:/* dark purple → teal → yellow */;
  --cmap-magma-stops:  /* black → purple → orange → cream */;
  --cmap-rdbu-stops:   /* 发散 red ↔ blue */;

  /* 字体 */
  --font-ui: "Inter", "Helvetica Neue", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Menlo", monospace;
  --font-size-tiny: 11px;
  --font-size-small: 12px;
  --font-size-body: 13px;
  --font-size-label: 13px;
  --font-size-title: 16px;
  --font-size-hero: 22px;

  /* 间距 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;

  /* 轨道布局 */
  --label-gutter-width: 120px;
  --label-gutter-width-compact: 72px;
  --track-separator: 1px;
  --track-pad-y: 4px;
  --track-pad-x: 8px;

  /* 尺寸 */
  --stage-min-height: 480px;
  --track-heights: { bigwig: 48px, bedgraph: 36px, tad-bar: 28px, gene: 80px,
                     loop: 70px, sv: 36px, pei: 28px, matrix: 480px };
}
```

### 7.2 轨道顺序
参考图会发散。两种解决方案：

1. **默认顺序是配置文件** — `config/trackOrder.default.yaml`。用户可在 UI 中拖拽重排；顺序持久化到 `localStorage`（`dataWeb.trackOrder.{species}.{comparisonMode}`）。
2. **"重置为参考图 N" 按钮** — 对每张参考图，保存 `references/demo{n}.yaml`，包含确切的 `tracks: [...]` 列表和生效的令牌。点击应用该预设。这就是让"像素级"成为一键可复现的办法。

### 7.3 每个参考图的主题覆盖
对每个 demo `n`：
- `config/themes/demo{n}.css` 仅覆盖与 `:root` 的差量。
- `config/layouts/demo{n}.yaml` 描述 lane 组成。
- 由 `<DemoPresetButton n={i}>` 一起加载，让审阅者无需碰代码就能切换"设计方案"。

### 7.4 像素差分流水线
- Playwright 对每个 `<DemoPresetButton>` 解析度在 `{1920×1080, 2560×1440, 1280×800}` 视口下截图，对照 `docx/refrences/demo{n}.png`。
- pixelmatch 阈值 0.05（颜色容差）；字体抗锯齿变化是唯一预期失败 — 让 `font-smoothing: antialiased` 在渲染与参考缩放间保持一致。

---

## 8. 实施阶段

每个阶段规模适合 **一个子代理任务 + 评审**。Phase 1–5 完成单样本流程。Phase 6–7 完成对比与润色。任何阶段开始前，前一阶段必须通过测试 + 人工截图证据。

### Phase 1 — 骨架 + 数据管道
**范围：**
- 仓库脚手架：`apps/web`（Vite+React+TS）、`apps/api`（FastAPI）、`pyproject.toml`、Makefile。
- Mock 数据适配器（`apps/api/app/mock/...`）生成猪与鸡的 Hi-C 矩阵（合成块对角 + 1000 个随机 loop）和占位 bedGraph。
- 所有接口对接 mock store 工作：`GET /api/species`、`/species/{species}/samples`、`/hic/matrix`、`/bigwig/values`、`/bed/overlap`。
- 健康检查 + `/docs` 的 OpenAPI。
**完成标准：** `curl /api/hic/matrix?...` 返回二进制 float32 + vmin/vmax。

### Phase 2 — 令牌、布局、外壳
**范围：**
- `tokens.css`（上文）、字体、配色系统。
- `<AppShell>` 网格 + `<TopBar>` + `<LeftRail>`（从 API 读样本列表）。
- 约 12 个猪样本 + 8 个鸡样本的 mock 注册 JSON。
- 右栏响应式折叠。
**完成标准：** `/` 展示带样本列表的样式化外壳，chromium 截图呈空白规范状态。

### Phase 3 — 线性轨道（Canvas 2D）
**范围：**
- `<LinearTrack>` 通用组件。
- `kind: "bigwig"`、`kind: "bedGraph"`、`kind: "tad-bar"`、`kind: "gene"`，全部用 mock 数据渲染。
- `<AxisGenomeCoords>`、`<YAxisRuler>`、跨轨道悬停的 `<HoverTooltip>`。
- Resize 处理 + DPR。
**完成标准：** 5 个轨道在合成数据上堆叠、同步悬停正常工作。

### Phase 4 — Hi-C 矩阵（WebGL）
**范围：**
- `<HiCMatrix2D>`：WebGL 初始化、Jet/Viridis/Magma 片段着色器、log 切换、服务端 `vmin/vmax` 的百分位截断。
- 绑定 viewport store；矩形选区 → 2D 下钻；crosshair 叠加。
- `<ColormapBar>`。
**完成标准：** Mock Hi-C 矩阵渲染、log 切换正常、1280×800 上 25kb bin 的 4Mb 区域 60fps 平移/缩放。

### Phase 5 — 叠加层 + 交互
**范围：**
- `<OverlayTrack kind="loop|sv|ctcf|pei" />` SVG 层。
- 点击固定 `<FeatureCallout>`，Esc 清除。
- `<ChromosomePicker>` + `<ZoomSlider>` + `<RegionInput>` 工作。
**完成标准：** Demo 1（"基线单样本视图"）匹配参考 PNG。

### Phase 6 — 对比模式
**范围：**
- `<SampleSelector>` 主+副、`<ComparisonModeSwitch>`、堆叠布局。
- `<DiffLane>` 处理 log2(A/B)。
- 镜像 bigwig 轨道变体。
- 所有 Hi-C + 线性轨道类型在堆叠/三联模式下验证。
**完成标准：** Demo 2–6（参考图覆盖的对比）匹配。

### Phase 7 — 像素级扫描
**范围：**
- `config/themes/demo{1..8}.css` + `config/layouts/demo{1..8}.yaml`。
- UI 中 `<DemoPresetButton>` 行。
- Playwright pixelmatch CI；可接受差分预算 ≤ 0.5%/图。
- README + ARCHITECTURE 文档；发布横幅。
**完成标准：** 全部 8 张参考图在容差内复现；CI 绿。

---

## 9. 样本数据策略

在真实 `.mcool`/`.bw` 到位前，API 提供 **确定性 mock 生成器**：
- **Hi-C 矩阵：** 按 (chr,start,end,bin) 程序化生成：
  - 对角暖带（随距离对数衰减）。
  - 合成 TAD 模式：每 ~200kb 一条块对角条纹。
  - 稀疏 loop 像素：随机锚点对增加亮像素。
  - AB compartment 信号：每 ~5Mb 的行列块制造"A vs B"质感。
  - 用 `sha256(chr:start:end:bin:sampleId)` 作种子，保证相同请求返回相同字节。
- **bigwig / bedGraph：** sin/cos 混合 + 随机位置的 Gaussian 峰；同样的种子方案。
- **TAD / loop / SV / PEI：** 合成的 `bed` / `bedpe`，每条染色体可预测的记录。
- **基因模型：** 静态 fixture（猪 5–10 个基因，鸡 5–10 个），mock 期使用；数据对接阶段替换为真实 GFF（Phase 5 边界，不在本计划范围）。

Mock 后端暴露完全相同的接口，所有 UI 工作无需等待真实数据。当真实数据到位时，只需切换数据源，组件不变。

---

## 10. 风险与开放问题

| # | 主题 | 决策 / 建议 | 开放问题 |
|---|---|---|---|
| 1 | **配色可访问性** | Hi-C 与 AB 默认 **Viridis**（色盲安全）；Jet 作为可选，带"（非色盲安全）"提示。AB 用 `RdBu`（已是发散 + 可访问）。状态栏始终显示当前调色板名称。 | 默认强制 Viridis 并完全移除 Jet？还是保留 Jet 以兼容已发表论文的视觉连续性？ |
| 2 | **移动 vs 桌面** | v1 仅桌面（≥ 1280px 视口）。以下显示指向桌面的回退提示。 | 是否需要平板竖屏支持？ |
| 3 | **浏览器最低支持** | Chrome 110+、Edge 110+、Firefox 120+、Safari 16.4+。需要 WebGL2 + ES2022。不支持 IE/旧版。 | 是否有机构用户强制使用更老版本？ |
| 4 | **性能预算** | 5Mb × 5Mb 区域 25kb bin（200×200 矩阵）在集成显卡上 60fps 平移与缩放。回退：首次矩阵请求 > 200ms 时显示带进度的骨架屏。 | 是否要将 FPS 上报到 Sentry / 仅 console？ |
| 5 | **Hi-C 最高 5kb 分辨率** | 存储它；只在用户下钻到 10kb bin 以下时渲染。高缩放警告："5kb 矩阵是 N×N cell — 在慢 GPU 上可能掉帧"。 | 长期：是否区分点击与下钻做降采样？ |
| 6 | **鸡的 CTCF** | 其数据中没有；UI 通过物种感知轨道注册隐藏鸡的 CTCF 行。 | 鸡是否要 `CTCF motif from chicken annotation (no ChIP)` 占位？ |
| 7 | **服务端二进制流** | 默认 `application/octet-stream` + 头 `X-Genomics-Dtype, X-Genomics-Shape`。需要写一个小的 TS `decoded-genomics-response.ts` 解码器，在 web 应用与未来 CLI 间共享。 | 是否对超大矩阵加 Brotli 压缩？大概率加。 |
| 8 | **多样本高 N 扇出** | 每个 lane 一个样本发起一次查询。4 路对比（少见）用并行 `Promise.all`。8 lane 以上切到 `Grid` 模式（4 象限）。 | v1 大概率不需要 — 在代码里 TODO 标记。 |
| 9 | **真实数据交接** | Mock 生成器必须返回与真实后端相同 *shape* 的响应，使切换只需单个环境变量。 | 真实数据在哪？S3？机构集群？写在 deploy 文档中。 |
| 10 | **服务端预变换** | 服务端 log1p + 百分位截断后再发送二进制。客户端拿到已 log 变换的 `float32`。UI 的"log"切换映射到 *显示为 log*，而非 *再变换*。 | 后续是否暴露"KR 归一化"切换？不在本计划范围。 |
| 11 | **鉴权 / 多租户** | v1 不在范围 — 单用户浏览器。 | 机构如需鉴权，延后到反向代理 + cookie。 |
| 12 | **国际化** | v1 仅中英双语镜像 tooltip；深度文案编辑后续。 | 令牌保持原文；延后完整 i18n。 |

---

## 11. 具体文件布局目标

```
dataWeb/
├─ apps/
│  ├─ web/
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
│  │  │  │  ├─ export/ (ExportMenu, CaptureCanvasPipeline)
│  │  │  │  └─ settings/(SettingsDrawer, KeyboardHints, DemoPresetButton, StatusBar)
│  │  │  ├─ store/             # zustand stores
│  │  │  ├─ hooks/             # useRangeQuery, useViewportSync 等
│  │  │  ├─ genomics/          # 纯坐标 / 调色板工具
│  │  │  │   ├─ coords.ts
│  │  │  │   ├─ colormap.ts
│  │  │  │   ├─ decoder.ts     # 二进制基因组响应解码器
│  │  │  │   └─ hic-shader/
│  │  │  │       ├─ vertex.glsl
│  │  │  │       └─ fragment.glsl
│  │  │  ├─ styles/
│  │  │  │   ├─ tokens.css
│  │  │  │   ├─ themes/{demo1..demo8}.css
│  │  │  │   └─ reset.css
│  │  │  └─ main.tsx
│  │  └─ vite.config.ts
│  └─ api/
│     ├─ app/
│     │  ├─ main.py            # FastAPI app
│     │  ├─ routes/{hic,bigwig,bed,gene,species,samples}.py
│     │  ├─ adapters/
│     │  │  ├─ base.py         # 接口
│     │  │  ├─ mock.py
│     │  │  └─ real.py         # pysam / pyBigWig / cooler
│     │  ├─ cache.py
│     │  └─ schemas.py
│     ├─ tests/
│     └─ pyproject.toml
├─ config/
│  ├─ trackOrder.default.yaml
│  └─ layouts/demo{1..8}.yaml
├─ data/registry.yaml           # 由 mock 生成；后续接真实数据
├─ docx/
│  ├─ plan/architecture.md      # 本文件
│  ├─ data/readme.md
│  └─ refrences/demo{1..8}.png
└─ tools/pixelmatch/            # playwright + pixelmatch 配置
```

---

## 12. 为子代理并行优化的构建顺序

为最大化并行性，按独立流分组：

| 流 | 阶段组件 | 独立性 |
|---|---|---|
| **数据流** | apps/api + mock 生成器 + pyproject + tests | 与 UI 工作独立 |
| **样式流** | tokens.css + 每 demo 主题覆盖 + Storybook 外壳 | 与数据 + 轨道独立 |
| **轨道流** | LinearTrack + kinds（Phase 3） | 与 Hi-C 矩阵 + 叠加独立 |
| **Hi-C 流** | HiCMatrix2D + WebGL 着色器 + ColormapBar（Phase 4） | 与线性 + 叠加独立 |

这四条流落地后，Phase 5–7 紧密串行（UI 集成需要所有部分在场）。

---

## 13. "架构已批准" 的验收标准

当用户确认以下事项后，本方案即可执行：

1. 所选技术栈（React+TS+Vite / FastAPI+coolers）。
2. 阶段顺序。
3. Mock 数据生成器作为桥梁可接受，直至真实数据到位。
4. 像素级机制（每 demo CSS + 布局 YAML + Playwright pixelmatch）。
5. v1 仅桌面，支持下限为 Chrome/Edge/Firefox/Safari 16.4+。
6. §10 第 1、5、8、10 行开放问题的具体答案 — 在并行流启动前。

批准后，下一步产出每阶段的子代理任务规格。