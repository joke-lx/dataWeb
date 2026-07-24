# dataWeb

多组学三维基因组浏览器 — 5 路由前端可视化应用。

## 项目简介

猪 (Sus scrofa 11.1) 多组学三维基因组浏览器，支持 Hi-C、差异 Hi-C、多组学轨道、3D 结构、CTCF motif 五大可视化模型。AB/TAD/PEI/RNA/ChIP 已接入真实数据（`D:\qq\猪多组学数据\猪多组学数据\`）并带 mock 回退；Hi-C/差异矩阵/CTCF/SV 仍使用确定性 **mock 数据**。

原 13/14 个独立路由已合并重构为 **5 个路由**，其中原有的 AB/IS/TAD/PEI/Loop/RNA/H3K/SV/Gene 等线性与结构模型统一收纳进 `/tracks` 路由的**分组子标签**。旧 URL 通过重定向保留书签兼容。

## 目录结构

```
dataWeb/
├── apps/
│   ├── api/          # FastAPI 后端（mock 生成器 + 真实数据接入层 + 9 个接口）
│   └── web/          # Vite + React + TS 前端（5 路由 + 多轨道组件）
├── pnpm-workspace.yaml
├── Makefile
├── README.md
└── docx/             # 规划文档
    ├── plan/         # architecture.md / brief.md / data_inventory.md / visualizable_features.md / real_data_integration.md
    ├── data/         # 原始需求
    └── refrences/    # 参考截图 demo1-8.png + demo/
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

## Docker 部署

CI/CD 通过 GitHub Actions：push 到 `main` 自动构建镜像 → 推送 GHCR → SSH 部署到云服务器。

```bash
# 本地容器编排（前+后端，nginx 反代 /api）
docker compose up --build
# → http://localhost:8080

# 云端由 .github/workflows/deploy.yml 自动完成：
#   build → ghcr.io/joke-lx/dataweb-{api,web} → 服务器 docker compose pull + up -d
#   web 暴露 :80，nginx 反代 /api 到内网后端
```

需要在 GitHub 仓库配置的 Secrets（`HOST` / `USERNAME` / `SSH_KEY` / `PORT`）、服务器准备、
排障等完整说明见 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**。


启动后访问 http://localhost:5173 ，默认路由 `/hic`。

## 路由结构（5）

顶部导航分两组：**main**（核心模型）与 **trigger**（补充视图）。

| 类别 | 按钮 | 路由 | 内容 | 渲染器 |
|---|---|---|---|---|
| main | Hi-C | `/hic` | Hi-C 接触矩阵（单样本） | WebGL2 fragment shader（RdBu_r / Viridis） |
| main | Δ Hi-C | `/differential` | log2(A/B) 差异分裂热图 | WebGL2 + diffRdBu 白心发散 |
| main | Tracks | `/tracks` | 多组学统一轨道视图（`?type=` 驱动子标签） | Lane 组合（Plotly / Canvas 2D / SVG） |
| main | 3D | `/3d` | Three.js chromatin ribbon | WebGL（Three.js） |
| trigger | CTCF Motif | `/ctcf-motif` | Motif logo + 基因型分布 | Canvas/SVG logo + 饼图 |

### `/tracks` 子标签

`/tracks` 通过 `?type=` 查询参数在一个统一布局里切换 10 个子标签，分为 3 组（`trackSpec.ts`）。每个子标签定义"主轨道 + 固定辅助轨道"。

| 分组 | 子标签 `?type=` | 主轨道 | 辅助轨道 |
|---|---|---|---|
| Sequencing | `rna_seq` | RNA-seq bigwig | TAD + Gene |
| Sequencing | `h3k4me3` | H3K4me3 bigwig | TAD + Gene |
| Sequencing | `h3k27ac` | H3K27ac bigwig | TAD + Gene |
| Structure | `ab` | AB index bedGraph | TAD + Gene |
| Structure | `is` | Insulation 折线 | TAD + Gene |
| Structure | `tad` | TAD boundary bar | Gene |
| Structure | `pei` | PEI anchors | TAD + Gene |
| Structure | `loop` | Hi-C + CTCF loop 弧线 | Gene |
| Structure | `sv` | DEL/DUP/INV/TRA glyphs | TAD + Gene |
| Annotation | `gene` | Gene model | — |

默认 `type=ab`。

### 旧 URL 重定向

以下旧路由通过 `<Navigate replace>` 自动重定向，保留书签与外链：

| 旧 URL | 新目标 |
|---|---|
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

（`/hic`、`/3d` 未变。）

## 交互

- **d3-zoom 缩放/平移**：所有路由共享视口，鼠标滚轮 + 拖拽同步
- **样本切换**：左栏 6 个 mock 样本（按 Brain/Liver/Muscle 分组）
- **子标签切换**：`/tracks` 路由内 SubTabBar 分组切换，写入 `?type=` 查询参数
- **Crosshair**：鼠标悬停显示红色垂直线 + bp 坐标
- **RegionInput**：`chr1:1000000-2000000` 跳转
- **ZoomSlider**：吸附到 1Mb / 250kb / 100kb / 50kb / 25kb / 10kb / 5kb
- **ColormapBar**：Hi-C / Differential Hi-C 颜色图例
- **3D 模型**：鼠标拖拽旋转、滚轮缩放

## 技术栈

- **包管理**：pnpm 10.x（monorepo workspace）
- **前端**：Vite 5 + React 18 + TypeScript 5（strict）+ React Router 7 + Zustand 5 + TanStack Query v5 + d3-zoom
- **后端**：FastAPI（Python 3.11+）+ Uvicorn + NumPy（+ 可选 pyBigWig 读真实 bigwig）
- **可视化**：
  - WebGL2 fragment shader（Hi-C + Differential Hi-C）
  - Three.js（3D Chromatin）
  - Plotly / Canvas 2D（线性轨道 + AB + TAD + PEI + Gene + SV + IS + motif logo + 基因型饼图）
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

## API 接口（11）

| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/health` | `{status:"ok"}` |
| GET | `/api/species` | 物种列表 + 染色体长度 |
| GET | `/api/species/{species}/samples` | 样本列表 |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=` | 二进制 float32 + vmin/vmax |
| GET | `/api/differential/matrix?sample_a=&sample_b=&chr=&start=&end=&bin=` | 二进制 float32 + 对称 vmin/vmax |
| GET | `/api/bigwig/values?sample=&track=&chr=&start=&end=&bins=` | 二进制 float32（真实 + mock 回退） |
| GET | `/api/bed/overlap?sample=&kind=ab\|tad\|pei\|gene\|is&chr=&start=&end=` | JSON records（真实 + mock 回退） |
| GET | `/api/ctcf/loops?sample=&chr=&start=&end=` | JSON bedpe records |
| GET | `/api/ctcf/motif?sample=&chr=&start=&end=` | JSON `{matrix, consensus, anchor_pos}` |
| GET | `/api/ctcf/genotype?population=` | JSON `{records:[...]}` SNP 基因型分布 |
| GET | `/api/sv?sample=&chr=&start=&end=` | JSON records with kind |

## 验证状态

- `pnpm typecheck`：`make typecheck`
- `pnpm build`：`pnpm --filter @dataweb/web build`
- `pytest`：42 passed（2 个真实 bigwig 用例需可选依赖 `pyBigWig`）
- 5 路由 + `/tracks` 10 子标签全部 wired to 真实组件（无 placeholder）

## 数据接入现状

- **已接真实数据**（带 mock 回退）：AB / TAD / PEI / RNA-seq / ChIP（H3K4me3, H3K27ac）
- **仍为 mock**：Hi-C / 差异矩阵 / CTCF loop / CTCF motif+genotype / SV

## 下一步

- Hi-C/差异矩阵/CTCF/SV 接真实数据
- CTCF motif/genotype 接真实 ChIP-seq + 变异数据（`ctcf_motif_reader.py` stub 已就位）
- 像素级 demo 预设按钮（8 张参考图复现）
- 3D 模型数据驱动（替代装饰几何）
- Playwright 像素差分 CI

完整架构方案见 `docx/plan/architecture.md`，数据资产清单见 `docx/plan/data_inventory.md`，真实数据接入见 `docx/plan/real_data_integration.md`。
