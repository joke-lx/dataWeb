# dataWeb

多组学三维基因组浏览器 — 14 路由前端可视化骨架。

## 项目简介

猪与鸡多组学三维基因组浏览器，支持 14 种可视化模型。当前阶段使用 **mock 数据** 搭建完整可视化骨架，后续阶段接入真实数据（`D:\qq\猪多组学数据\猪多组学数据\`）。

主页面顶部 **14 个模型按钮**，点击切换路由，每个路由展示对应的多轨道可视化布局。

## 目录结构

```
dataWeb/
├── apps/
│   ├── api/          # FastAPI 后端（mock 数据生成器 + 8 个接口）
│   └── web/          # Vite + React + TS 前端（14 路由 + 多轨道组件）
├── pnpm-workspace.yaml
├── Makefile
├── README.md
└── docx/             # 规划文档
    ├── plan/         # architecture.md / brief.md / data_inventory.md / visualizable_features.md
    ├── data/         # 原始需求
    └── refrences/    # 8 张参考截图 demo1-8.png + demo.html
```

## 启动命令

```bash
# 安装依赖
make install

# 并行启动 api + web（推荐）
make dev

# 或分别启动
make api    # FastAPI 监听 :8000
make web    # Vite 监听 :5173

# 类型检查 / 构建
make typecheck
pnpm --filter @dataweb/web build
```

启动后访问 http://localhost:5173 ，默认路由 `/hic`。

## 14 路由模型

主页面顶部导航栏依次排列 14 个模型按钮，点击切换主画布。每个路由组合"主轨道 + 辅助轨道"。

| # | 按钮 | 路由 | 主轨道 | 辅助轨道 | 渲染器 |
|---|---|---|---|---|---|
| 1 | Hi-C | `/hic` | Hi-C 接触矩阵 | TAD + Gene | WebGL2 fragment shader（RdBu_r / Viridis） |
| 2 | Differential Hi-C | `/differential-hic` | log2(A/B) 差异矩阵 | Gene | WebGL2 + diffRdBu 白心发散 |
| 3 | AB Index | `/ab-index` | AB compartment bar | TAD + Gene | Canvas 2D diverging bar |
| 4 | Insulation Score | `/insulation-score` | IS line + TAD ticks | TAD + Gene | Canvas 2D 折线 |
| 5 | TAD | `/tad` | TAD boundary bar | Gene | Canvas 2D 灰条 |
| 6 | PEI Anchors | `/pei` | PEI 锚点 | Gene | Canvas 2D 散点 |
| 7 | CTCF Loops | `/ctcf-loops` | Hi-C + Loop 弧线 | Gene | SVG quadratic Bézier |
| 8 | RNA-seq | `/rna-seq` | RNA bigwig | Gene | Canvas 2D 填充曲线 |
| 9 | H3K4me3 | `/h3k4me3` | H3K4me3 bigwig | Gene | Canvas 2D 填充曲线 |
| 10 | H3K27ac | `/h3k27ac` | H3K27ac bigwig | Gene | Canvas 2D 填充曲线 |
| 11 | SV | `/sv` | DEL/DUP/INV/TRA 标记 | Gene | Canvas 2D glyphs |
| 12 | Gene Annotation | `/gene` | Gene model | — | Canvas 2D exon/intron |
| 13 | 3D Structure | `/3d` | Three.js ribbon | — | WebGL（Three.js） |
| 14 | Comparison | `/comparison` | 全部堆叠（双样品） | — | 复用 Task H 布局 |

## 交互

- **d3-zoom 缩放/平移**：所有路由共享视口，鼠标滚轮 + 拖拽同步
- **样本切换**：左栏 6 个 mock 样本（按 Brain/Liver/Muscle 分组）
- **Crosshair**：鼠标悬停显示红色垂直线 + bp 坐标
- **RegionInput**：`chr1:1000000-2000000` 跳转
- **ZoomSlider**：吸附到 1Mb / 250kb / 100kb / 50kb / 25kb / 10kb / 5kb
- **ColormapBar**：Hi-C / Differential Hi-C 颜色图例
- **3D 模型**：鼠标拖拽旋转、滚轮缩放

## 技术栈

- **包管理**：pnpm 10.x（monorepo workspace）
- **前端**：Vite 5 + React 18 + TypeScript 5（strict）+ React Router 7 + Zustand 5 + TanStack Query v5 + d3-zoom
- **后端**：FastAPI（Python 3.11+）+ Uvicorn + NumPy
- **可视化**：
  - WebGL2 fragment shader（Hi-C + Differential Hi-C）
  - Three.js（3D Chromatin）
  - Canvas 2D（线性轨道 + AB + TAD + PEI + Gene + SV + IS）
  - SVG（CTCF Loops arcs）
- **二进制传输**：`application/octet-stream` + `X-Genomics-{Dtype,Shape,Vmin,Vmax}` 头

## mock 样本（6 个）

| ID | 组织 | 品种 | 性别 |
|---|---|---|---|
| Brain_BF3 | Brain | Berkshire | F |
| Brain_TM4 | Brain | Tibetan | M |
| Liver_BF3 | Liver | Berkshire | F |
| Liver_TF2_28d | Liver | Tibetan | F（28d） |
| Muscle_BM4 | Muscle | Berkshire | M |
| Muscle_TM3 | Muscle | Tibetan | M |

所有 mock 数据用 `sha256(sample_id|chr|start|end|bin|track)` 作种子，确定性可复现。

## API 接口（8 个）

| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/species` | 物种列表 + 染色体长度 |
| GET | `/api/species/{species}/samples` | 样本列表 |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=` | 二进制 float32 + vmin/vmax |
| GET | `/api/differential/matrix?sample_a=&sample_b=&chr=&start=&end=&bin=` | 二进制 float32 + 对称 vmin/vmax |
| GET | `/api/bigwig/values?sample=&track=&chr=&start=&end=&bins=` | 二进制 float32 |
| GET | `/api/bed/overlap?sample=&kind=ab\|tad\|pei\|gene\|is&chr=&start=&end=` | JSON records |
| GET | `/api/ctcf/loops?sample=&chr=&start=&end=` | JSON bedpe records |
| GET | `/api/sv?sample=&chr=&start=&end=` | JSON records with kind |

## 验证状态

- `pnpm typecheck`：0 错误
- `pnpm build`：成功（147 modules / 783 kB / 214 kB gzip）
- `pytest`：17/17 通过
- 14 路由全部 wired to 真实组件（无 placeholder）

## 下一步

- 接真实数据（`D:\qq\猪多组学数据\猪多组学数据\`）— AB/TAD/PEI/Chip/RNA 5 类已就绪；Hi-C/IS/Loop/CTCF/SV 继续 mock
- 像素级 demo 预设按钮（8 张参考图复现）
- 3D 模型数据驱动（替代装饰几何）
- Playwright 像素差分 CI

完整架构方案见 `docx/plan/architecture.md`，数据资产清单见 `docx/plan/data_inventory.md`。
