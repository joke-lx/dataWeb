# Project Index: dataWeb

Generated: 2026-07-23

## 📋 Project Overview

多组学三维基因组浏览器 (Multi-omics 3D Genome Browser) — 5 路由前端可视化应用
- **物种范围**：猪 (Sus scrofa 11.1)，预留多物种扩展点
- **数据源**：真实数据接入层已就绪 (`D:\qq\猪多组学数据\猪多组学数据\`)，AB/TAD/PEI/RNA/ChIP 走真实数据 + mock 回退；Hi-C/差异矩阵/CTCF/SV 仍为 mock
- **路由结构**：原 13/14 独立路由已合并重构为 **5 路由**（`/hic`、`/differential`、`/tracks`、`/3d`、`/ctcf-motif`），旧 URL 通过 `LEGACY_REDIRECTS` 重定向到 `/tracks?type=...`

## 📁 Project Structure

```
dataWeb/
├── apps/
│   ├── api/                         # FastAPI 后端
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI 入口 (9 router)
│   │   │   ├── mock/                # Mock 数据生成器
│   │   │   │   ├── registry.py      # 重导出 CHROMOSOMES/SAMPLES/SPECIES/find_sample
│   │   │   │   ├── samples.py       # 6 mock 样本 + 19 条染色体
│   │   │   │   └── generators.py    # hic/bigwig/bed/diff/IS/CTCF loop/motif/genotype/SV 生成器
│   │   │   ├── real_data/           # 真实数据接入层
│   │   │   │   ├── chr_utils.py         # chr 名称归一化
│   │   │   │   ├── sample_resolver.py   # 样本解析 + 路径解析 (registry.yaml)
│   │   │   │   ├── ab_reader.py         # AB compartment + mean track
│   │   │   │   ├── tad_reader.py        # TAD boundary
│   │   │   │   ├── pei_reader.py        # PEI anchors
│   │   │   │   ├── bigwig_reader.py     # RNA/ChIP bigwig (需 pyBigWig)
│   │   │   │   └── ctcf_motif_reader.py # CTCF motif/genotype (stub, 触发 mock 回退)
│   │   │   └── routes/              # 9 个 API 路由
│   │   │       ├── species.py, samples.py
│   │   │       ├── hic.py, bigwig.py, bed.py
│   │   │       ├── differential.py, ctcf.py, ctcf_motif.py, sv.py
│   │   ├── tests/                   # pytest (test_health/mock/pei/real_tad/ctcf_motif)
│   │   └── scripts/verify_registry.py
│   └── web/                         # Vite + React 18 + TS (strict)
│       ├── src/
│       │   ├── main.tsx, App.tsx    # BrowserRouter + 5 route + legacy 重定向
│       │   ├── api/                 # client.ts (fetch wrapper) + types.ts
│       │   ├── genomics/            # 坐标工具 + GLSL 着色器
│       │   ├── store/               # zustand 状态 (viewport/samples/cursor)
│       │   ├── hooks/               # useD3Zoom / useRangeQuery / useActiveSample
│       │   ├── routes/              # 5 路由组件 + registry.ts + trackSpec.ts
│       │   └── components/
│       │       ├── shell/           # AppShell/TopBar/LeftRail/StatusBar
│       │       ├── stage/           # Stage + Lane 轨道
│       │       ├── hic/             # HiCMatrix2D (WebGL2) + ColormapBar
│       │       ├── linear/          # PlotlyTrack (RNA/H3K4me3/H3K27ac)
│       │       ├── overlay/         # CrosshairLayer + CTCFLoops (SVG)
│       │       ├── tracks/          # SubTabBar/LoopTrack/CtcfMotifLogo/CtcfGenotypePie
│       │       ├── 3d/              # ThreeDChromatin (Three.js)
│       │       └── nav/             # RegionInput + ZoomSlider
│       └── vite.config.ts
├── docx/
│   ├── plan/                        # architecture.md / brief.md / data_inventory.md / real_data_integration.md
│   ├── data/                        # 原始需求
│   └── refrences/                   # demo1-8.png 参考截图 + demo/
├── Makefile                         # install / dev / api / web / typecheck
├── pnpm-workspace.yaml             # monorepo 包管理
└── README.md
```

## 🚀 Entry Points

| 入口 | 路径 | 用途 |
|------|------|------|
| API 启动 | `apps/api/app/main.py` | FastAPI 应用，含 CORS + 9 router |
| Web 启动 | `apps/web/src/main.tsx` → `App.tsx` | React Router + 5 routes + legacy 重定向 |
| Mock 入口 | `apps/api/app/mock/registry.py` | CHROMOSOMES/SAMPLES/SPECIES/find_sample 重导出 |
| 真实数据入口 | `apps/api/app/real_data/sample_resolver.py` | registry.yaml + 路径解析 |
| 路由/轨道元数据 | `apps/web/src/routes/registry.ts` + `trackSpec.ts` | 5 RouteSpec + TRACK_CATALOG/SUB_TABS |
| 测试 | `apps/api/tests/` | pytest（bigwig 真实数据用例需 pyBigWig） |

## 📦 Core Modules

### 后端 (apps/api/app/)

| 模块 | 路径 | 关键导出 | 用途 |
|------|------|----------|------|
| routes/species | `routes/species.py` | GET /api/species | 物种 + 染色体列表 |
| routes/samples | `routes/samples.py` | GET /api/species/{s}/samples | 样本元数据 |
| routes/hic | `routes/hic.py` | GET /api/hic/matrix | Hi-C 二进制 float32 |
| routes/differential | `routes/differential.py` | GET /api/differential/matrix | log2(A/B) 矩阵 |
| routes/bigwig | `routes/bigwig.py` | GET /api/bigwig/values | 1D bigwig float32（真实 + mock 回退） |
| routes/bed | `routes/bed.py` | GET /api/bed/overlap | AB/TAD/PEI/Gene/IS（真实 + mock 回退） |
| routes/ctcf | `routes/ctcf.py` | GET /api/ctcf/loops | CTCF bedpe |
| routes/ctcf_motif | `routes/ctcf_motif.py` | GET /api/ctcf/motif, GET /api/ctcf/genotype | 合成 CTCF PWM + 基因型分布 |
| routes/sv | `routes/sv.py` | GET /api/sv | DEL/DUP/INV/TRA |
| mock/generators | `mock/generators.py` | `hic_matrix`/`bigwig_track`/`bed_records`/`differential_hic`/`insulation_score`/`ctcf_loops`/`ctcf_motif_matrix`/`ctcf_genotype_distribution`/`sv_records` | 确定性 mock (sha256 种子) |
| real_data/sample_resolver | `real_data/sample_resolver.py` | `load_registry`/`get_sample`/`list_samples`/`resolve_ab_path` | 真实数据 YAML 索引 |
| real_data readers | `real_data/{ab,tad,pei,bigwig,ctcf_motif}_reader.py` | `read_ab_*`/`read_tad_sample`/`read_pei_sample`/`read_bigwig_track`/`read_ctcf_*` | 真实数据读取（失败即回退 mock） |

### 前端 (apps/web/src/)

| 模块 | 路径 | 关键导出 | 用途 |
|------|------|----------|------|
| App | `App.tsx` | `App` | BrowserRouter + 5 Route + LEGACY_REDIRECTS |
| routes/registry | `routes/registry.ts` | `ROUTES` (5 RouteSpec), `LEGACY_REDIRECTS` | 路由元数据 (id/path/label/description/category) + 旧 URL 映射 |
| routes/trackSpec | `routes/trackSpec.ts` | `TRACK_CATALOG` (11 TrackSpec), `SUB_TABS` (10), `GROUP_LABELS` | Tracks 路由的轨道目录 + 子标签配置 |
| routes/TracksRoute | `routes/TracksRoute.tsx` | `TracksRoute` | `?type=` 驱动的多组学统一轨道视图 |
| routes/CtcfMotifRoute | `routes/CtcfMotifRoute.tsx` | `CtcfMotifRoute` | CTCF motif logo + 基因型饼图 |
| store/viewport | `store/viewport.ts` | `useViewport` | 视口 (chr/start/end/bin) + zoom/pan + BIN_STEPS |
| store/samples | `store/samples.ts` | `useSamples` | 样本列表 + active |
| store/cursor | `store/cursor.ts` | `useCursor` | 鼠标 crosshair 状态 |
| hooks/useD3Zoom | `hooks/useD3Zoom.ts` | `useD3Zoom` | d3-zoom 集成 (Ctrl+wheel 缩放 / drag 平移) |
| hooks/useRangeQuery | `hooks/useRangeQuery.ts` | `useRangeQuery` | TanStack Query 包装 |
| hooks/useActiveSample | `hooks/useActiveSample.ts` | `useActiveSample` | 当前样本 hook |
| api/client | `api/client.ts` | `fetchSpecies`/`fetchSamples`/`fetchHicMatrix`/`fetchDifferentialHic`/`fetchBigwig`/`fetchBed`/`fetchSV`/`fetchCtcfMotif`/`fetchCtcfGenotype` | fetch 包装 + 二进制响应解析 |
| api/types | `api/types.ts` | `Sample`/`Species`/`BedKind`/`BedRecordByKind`/`CtcfMotifResponse`/`CtcfGenotypeResponse` | 共享类型 |
| components/shell/TopBar | `components/shell/TopBar.tsx` | `TopBar` | main + trigger 两组路由切换按钮 |
| components/stage/Lane | `components/stage/Lane.tsx` | `Lane` | 单一轨道 (hic/bigwig/bedGraph/is/tadBar/pei/sv/gene) |
| components/hic/HiCMatrix2D | `components/hic/HiCMatrix2D.tsx` | `HiCMatrix2D` | WebGL2 R32F 着色器 (RdBu_r/Viridis/diffRdBu) |
| components/linear/PlotlyTrack | `components/linear/PlotlyTrack.tsx` | `PlotlyTrack` | RNA-seq/H3K4me3/H3K27ac |
| components/tracks/SubTabBar | `components/tracks/SubTabBar.tsx` | `SubTabBar` | 分组子标签栏 (Sequencing/Structure/Annotation) |
| components/tracks/LoopTrack | `components/tracks/LoopTrack.tsx` | `LoopTrack` | Hi-C lane + CTCF loop SVG 弧线 |
| components/tracks/CtcfMotifLogo | `components/tracks/CtcfMotifLogo.tsx` | `CtcfMotifLogo` | PWM motif logo |
| components/tracks/CtcfGenotypePie | `components/tracks/CtcfGenotypePie.tsx` | `CtcfGenotypePie` | SNP 基因型分布饼图 |
| components/3d/ThreeDChromatin | `components/3d/ThreeDChromatin.tsx` | `ThreeDChromatin` | Three.js ribbon |
| components/nav/RegionInput | `components/nav/RegionInput.tsx` | `RegionInput` | `chr1:1-2Mb` 跳转 |
| components/nav/ZoomSlider | `components/nav/ZoomSlider.tsx` | `ZoomSlider` | BIN_STEPS 吸附 |

## 🧬 Mock Samples (6)

| ID | 组织 | 品种 | 性别 |
|----|------|------|------|
| Brain_BF3 | Brain | Berkshire | F |
| Brain_TM4 | Brain | Tibetan | M |
| Liver_BF3 | Liver | Berkshire | F |
| Liver_TF2_28d | Liver | Tibetan | F (28d) |
| Muscle_BM4 | Muscle | Berkshire | M |
| Muscle_TM3 | Muscle | Tibetan | M |

确定性种子：`sha256(sample_id|chr|start|end|bin|track)[:16]`

## 🛣 Routes (5)

顶部导航分两组：**main**（核心模型）+ **trigger**（补充视图）。

| 路由 | 类别 | Label | 主内容 | 渲染器 |
|------|------|-------|--------|--------|
| `/hic` | main | Hi-C | Hi-C 接触矩阵（单样本） | WebGL2 fragment shader (RdBu_r/Viridis) |
| `/differential` | main | Δ Hi-C | log2(A/B) 差异分裂热图 | WebGL2 + diffRdBu 白心发散 |
| `/tracks` | main | Tracks | 多组学统一轨道视图（`?type=` 驱动） | Lane 组合 (Plotly / Canvas / SVG) |
| `/3d` | main | 3D | Three.js chromatin ribbon | WebGL (Three.js) |
| `/ctcf-motif` | trigger | CTCF Motif | Motif logo + 基因型分布 | Canvas/SVG logo + 饼图 |

### `/tracks` 子标签（SUB_TABS，`?type=`）

| 分组 (group) | 子标签 (type) | 主轨道 | 辅助轨道 (aux) |
|------|------|--------|----------------|
| Sequencing | `rna_seq` | RNA-seq bigwig | TAD + Gene |
| Sequencing | `h3k4me3` | H3K4me3 bigwig | TAD + Gene |
| Sequencing | `h3k27ac` | H3K27ac bigwig | TAD + Gene |
| Structure | `ab` | AB index bedGraph | TAD + Gene |
| Structure | `is` | Insulation line | TAD + Gene |
| Structure | `tad` | TAD boundary bar | Gene |
| Structure | `pei` | PEI anchors | TAD + Gene |
| Structure | `loop` | Hi-C + CTCF loop 弧线 (LoopTrack) | Gene |
| Structure | `sv` | DEL/DUP/INV/TRA glyphs | TAD + Gene |
| Annotation | `gene` | Gene model | — |

默认 `type=ab`（未匹配时回退到 Structure→AB）。

### Legacy URL 重定向 (LEGACY_REDIRECTS)

旧路由通过 `<Navigate replace>` 重定向，保留书签/外链：

| 旧 URL | 新目标 |
|--------|--------|
| `/differential-hic` | `/differential` |
| `/ab-index` | `/tracks?type=ab` |
| `/insulation-score` | `/tracks?type=is` |
| `/tad` | `/tracks?type=tad` |
| `/pei` | `/tracks?type=pei` |
| `/ctcf-loops` | `/tracks?type=loop` |
| `/rna-seq` | `/tracks?type=rna_seq` |
| `/h3k4me3` | `/tracks?type=h3k4me3` |
| `/h3k27ac` | `/tracks?type=h3k27ac` |
| `/sv` | `/tracks?type=sv` |
| `/gene` | `/tracks?type=gene` |

（`/hic`、`/3d` 未变，无需重定向）

## 🔧 Configuration

| 文件 | 用途 |
|------|------|
| `pyproject.toml` (api) | FastAPI 0.110+ / numpy / uvicorn / pytest / hatchling build（pyBigWig 为可选，真实 bigwig 读取需要） |
| `package.json` (web) | React 18 / Vite 5 / TS 5 / TanStack Query v5 / Zustand 5 / Three.js / d3-zoom / plotly.js-dist-min |
| `Makefile` | `install` / `dev` / `api` / `web` / `typecheck` / `clean` |
| `pnpm-workspace.yaml` | monorepo: `apps/*` |
| `apps/api/app/real_data/registry.yaml` | 真实数据样本清单 (data path 索引) |
| `apps/web/vite.config.ts` | Vite + API proxy |

## 🔌 API Endpoints (11)

| 方法 | 路径 | 返回 |
|------|------|------|
| GET | `/api/health` | `{status:"ok"}` |
| GET | `/api/species` | 物种 + 染色体列表 |
| GET | `/api/species/{species}/samples` | 样本列表 |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=` | 二进制 float32 + vmin/vmax |
| GET | `/api/differential/matrix?sample_a=&sample_b=&chr=&start=&end=&bin=` | 二进制 float32 + 对称 vmin/vmax |
| GET | `/api/bigwig/values?sample=&track=&chr=&start=&end=&bins=` | 二进制 float32（真实 + mock 回退） |
| GET | `/api/bed/overlap?sample=&kind=ab\|tad\|pei\|gene\|is&chr=&start=&end=` | JSON records（真实 + mock 回退） |
| GET | `/api/ctcf/loops?sample=&chr=&start=&end=` | JSON bedpe |
| GET | `/api/ctcf/motif?sample=&chr=&start=&end=` | JSON `{matrix, consensus, anchor_pos}` |
| GET | `/api/ctcf/genotype?population=` | JSON `{records:[...]}` SNP 基因型分布 |
| GET | `/api/sv?sample=&chr=&start=&end=` | JSON records |

二进制传输约定：`application/octet-stream` + 自定义头
- `X-Genomics-Dtype`: `float32`
- `X-Genomics-Shape`: `"{rows},{cols}"`
- `X-Genomics-Vmin` / `X-Genomics-Vmax`: 颜色映射范围

## 📚 Documentation

- `README.md` — 顶级项目说明
- `docx/plan/architecture.md` — 架构方案
- `docx/plan/brief.md` — 项目 brief
- `docx/plan/data_inventory.md` — 数据资产清单
- `docx/plan/visualizable_features.md` — 28 样本可视化特征
- `docx/plan/real_data_integration.md` — 真实数据接入方案

## 🧪 Test Coverage

- `apps/api/tests/`：`test_health.py` + `test_mock.py` + `test_pei.py` + `test_real_tad.py` + `test_ctcf_motif.py` + `conftest.py`
- pytest 状态：**42 passed**（2 个真实 bigwig 用例需可选依赖 `pyBigWig`，未安装时跳过/失败）
- typecheck (`tsc --noEmit`): 见 `make typecheck`
- build：`pnpm --filter @dataweb/web build`

## 🔗 Key Dependencies

### 后端
- `fastapi>=0.110` — Web 框架
- `uvicorn[standard]>=0.27` — ASGI server
- `numpy>=1.26` — 矩阵生成
- `pyyaml>=6.0` — registry.yaml 解析
- `pyBigWig`（可选）— 真实 bigwig 轨道读取

### 前端
- `react@^18.3.1` + `react-dom@^18.3.1` — UI 框架
- `react-router-dom@^7.18.1` — 路由 (含 useSearchParams 驱动 `/tracks`)
- `zustand@^5.0.0` — 状态管理
- `@tanstack/react-query@^5.51.0` — 数据请求
- `d3-selection@^3` + `d3-zoom@^3` — 缩放/平移
- `plotly.js-dist-min@^3.7.0` — 线性轨道
- `three@^0.185.1` — 3D Chromatin
- `typescript@^5.4.5` (strict) + `vite@^5.4.0` + `@vitejs/plugin-react@^4.3.1`

## 📝 Quick Start

```bash
# 安装依赖
make install                    # 等价于 pnpm install

# 并行启动 api + web（推荐）
make dev                        # :8000 (api) + :5173 (web)

# 分别启动
make api                        # FastAPI 监听 :8000
make web                        # Vite 监听 :5173

# 验证
make typecheck                  # tsc --noEmit
pnpm --filter @dataweb/web build
pytest apps/api/tests/          # 42 passed（真实 bigwig 用例需 pyBigWig）

# 浏览器
# 访问 http://localhost:5173 ，默认路由 /hic
```

## 🚧 下一步

1. Hi-C/差异矩阵/CTCF loop/SV 接真实数据（当前 mock）
2. CTCF motif/genotype 接真实 ChIP-seq + 变异数据（`ctcf_motif_reader.py` stub 已就位）
3. 像素级 demo 预设按钮（8 张参考图复现）
4. 3D 模型数据驱动（替代装饰几何）
5. Playwright 像素差分 CI

## 💾 Storage / Data

- **Mock 数据**：`apps/api/app/mock/generators.py` 内存中确定性生成
- **真实数据路径**：`D:\qq\猪多组学数据\猪多组学数据\` (硬编码于 `real_data/sample_resolver.py:DATA_ROOT`)
- **真实数据索引**：`apps/api/app/real_data/registry.yaml`
- **真实数据已接入**：AB / TAD / PEI / RNA-seq / ChIP (H3K4me3/H3K27ac) — 失败即回退 mock
- **仍为 mock**：Hi-C / 差异矩阵 / CTCF loop / CTCF motif+genotype / SV

## 🎯 Notable Patterns

- **路由合并 + 子标签** — 原 10+ 独立线性/结构路由合并进 `/tracks`，由 `trackSpec.ts` 的 `SUB_TABS` + `TRACK_CATALOG` 声明式驱动，`?type=` 查询参数选择子标签
- **Legacy 重定向** — `LEGACY_REDIRECTS` + `<Navigate replace>` 保留旧书签/外链
- **真实数据 + mock 回退** — bed/bigwig 路由优先读真实数据，任何失败（缺样本/缺文件/缺依赖）静默回退确定性 mock，UI 永不 break
- **二进制传输头协议** — `X-Genomics-Dtype/Shape/Vmin/Vmax` 自定义响应头携带矩阵元信息，避免 JSON 包装
- **WebGL2 R32F 纹理** — Hi-C 矩阵作为单通道 float 纹理直接上传 GPU，配合 fragment shader 实时上色
- **Zustand 状态切片** — viewport / samples / cursor 三个独立 store，避免单一大 store 重渲染
- **确定性格子生成** — `sha256(...)|track` 作 seed 派生 numpy Generator，相同请求永远返回相同字节
- **d3-zoom 与 store 双向同步** — 通过 `useD3Zoom` hook 把 d3 transform 写回 zustand store，路由切换时保持视口一致
