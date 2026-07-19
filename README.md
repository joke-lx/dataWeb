# dataWeb

多组学三维基因组浏览器 — 前端可视化骨架。

## 项目简介

支持 6 类轨道（Hi-C、AB index、TAD 边界、PEI、bigwig、Gene model）的多组学浏览器，覆盖猪（Sus scrofa）多组学数据。当前阶段使用 **mock 数据** 搭建完整可视化骨架，后续阶段接入真实数据（`D:\qq\猪多组学数据\猪多组学数据\`）。

## 目录结构

```
dataWeb/
├── apps/
│   ├── api/          # FastAPI 后端（mock 数据生成器 + 5 个接口）
│   └── web/          # Vite + React + TS 前端（6 类轨道 + 对比模式）
├── pnpm-workspace.yaml
├── Makefile
├── README.md
└── docx/             # 规划文档（架构方案、需求、参考截图、数据盘点）
    ├── plan/         # architecture.md / brief.md / data_inventory.md / visualizable_features.md
    ├── data/         # 原始需求
    └── refrences/    # 8 张参考截图 demo1-8.png
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

# 清理
make clean
```

启动后访问 http://localhost:5173

## 技术栈

- **包管理**：pnpm 10.x（monorepo workspace）
- **前端**：Vite 5 + React 18 + TypeScript 5（strict）+ Zustand 5 + TanStack Query v5 + d3-zoom
- **后端**：FastAPI（Python 3.11+）+ Uvicorn + NumPy
- **可视化**：
  - WebGL2 fragment shader（Hi-C 矩阵，RdBu_r / Viridis 调色板）
  - Canvas 2D（线性轨道：bigwig / AB / TAD / PEI / gene）
  - SVG（crosshair 叠加层）
- **二进制传输**：`application/octet-stream` + `X-Genomics-{Dtype,Shape,Vmin,Vmax}` 头

## 当前已实现功能（Task A–H）

### 轨道类型（6 类，全部 mock 数据驱动）
1. **Hi-C 接触矩阵**（WebGL2）— 对角暖带 + TAD 块对角 + 稀疏 loop + AB compartment 信号，已 log1p
2. **AB index**（Canvas 2D）— diverging 红/蓝 bar，零基线
3. **TAD 边界**（Canvas 2D）— 深灰 bar + 浅灰间隔
4. **PEI 锚点**（Canvas 2D）— 圆点，按 -log10P 着色，含关联基因 ID
5. **bigwig 信号**（Canvas 2D）— RNA-seq filled peaks，A/B 样本红蓝区分
6. **Gene model**（Canvas 2D）— exon 矩形 + intron 线 + strand 箭头

### 交互
- **d3-zoom 缩放/平移**：鼠标滚轮缩放，拖拽平移，所有轨道同步
- **样本切换**：左栏 6 个 mock 样本（Brain/Liver/Muscle × Berkshire/Tibetan）
- **Crosshair**：鼠标悬停显示红色垂直线 + bp 坐标读数
- **RegionInput**：`chr1:1000000-2000000` 跳转
- **ZoomSlider**：吸附到规范分辨率（1Mb / 250kb / 100kb / 50kb / 25kb / 10kb / 5kb）
- **ColormapBar**：Hi-C 颜色图例 + RdBu/Viridis 切换，显示真实 vmin/vmax

### 对比模式
- **上下堆叠两个 Hi-C**：共享视口，8px seam 分隔
- **镜像 bigwig**：样本 A 红色向上，样本 B 蓝色向下
- **AB / TAD 成对显示**：A/B 两套并排

## mock 样本（6 个，28 个真实样本的子集）

| ID | 组织 | 品种 | 性别 |
|---|---|---|---|
| Brain_BF3 | Brain | Berkshire | F |
| Brain_TM4 | Brain | Tibetan | M |
| Liver_BF3 | Liver | Berkshire | F |
| Liver_TF2_28d | Liver | Tibetan | F（28d） |
| Muscle_BM4 | Muscle | Berkshire | M |
| Muscle_TM3 | Muscle | Tibetan | M |

所有 mock 数据用 `sha256(sample_id|chr|start|end|bin|track)` 作种子，确定性可复现。

## API 接口

| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/species` | 物种列表 + 染色体长度 |
| GET | `/api/species/{species}/samples` | 样本列表 |
| GET | `/api/hic/matrix?sample=&chr=&start=&end=&bin=` | 二进制 float32 + vmin/vmax 头 |
| GET | `/api/bigwig/values?sample=&track=&chr=&start=&end=&bins=` | 二进制 float32 |
| GET | `/api/bed/overlap?sample=&kind=ab\|tad\|pei\|gene&chr=&start=&end=` | JSON records |

## 验证状态

- `pnpm typecheck`：0 错误
- `pnpm build`：成功（253 KB JS / 81 KB gzip）
- `pytest`：12/12 通过
- 6 个 mock 样本可加载、6 类轨道渲染正常、d3-zoom 同步、对比模式像素级验证通过

## 下一步（不在当前阶段）

- 接入真实数据（`D:\qq\猪多组学数据\猪多组学数据\`）— 见 `docx/plan/data_inventory.md`
- ΔIntensity 差异热图（log2 矩阵）
- Loop 弧线、CTCF motif、SV 轨道
- 3D 折叠模型（Three.js）
- 像素级 demo 预设按钮（8 张参考图复现）
- Playwright 像素差分 CI

完整架构方案见 `docx/plan/architecture.md`，数据资产清单见 `docx/plan/data_inventory.md`。
