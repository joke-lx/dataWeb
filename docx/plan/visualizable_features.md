# 可视化功能清单（基于现有数据）

**核心结论：** 现有数据可实现 **5 大类真实可视化 + 1 类必须 mock + 1 类部分可实现**。无需等待更多数据。

---

## 1. 现有数据可立即实现的可视化（无需等待更多数据）

### 1.1 A/B Compartment 轨道（28 样本 + 15 均值）
**真实文件：** `01.AB_compartment/`，43 文件，168 MB
- **28 个个体样本 AB index 轨道**：每个样本 1 条 bedGraph 风格轨道，20kb 分辨率
- **15 条均值轨道**：3 套分组（Breed/Parental/Tissue）
- **可实现功能：**
  - 单样本 A/B compartment 沿基因组分布（红色 A / 蓝色 B，零基线 bar）
  - 28 样本切换浏览（按 Brain/Liver/Muscle × B/T × F/M）
  - 品种对比（Berkshire vs Tibetan 均值叠加）
  - 亲本对比（Maternal vs Paternal 均值叠加）
  - 区域放大 + crosshair + hover tooltip

### 1.2 TAD 边界轨道（28 样本 + 27 裁剪 + 6 发育时间）
**真实文件：** `02.TAD/boundary/`，66 文件，6 MB
- **37 条原始 TAD 边界 bed**：每个样本 1 条，4 列（index, chrom, start, end）
- **27 条 ≥200kb 裁剪 TAD**：5 列（+ length）
- **6 条发育时间样本**（仅 Liver）：28d vs 180d 各 3 条
- **可实现功能：**
  - 单样本 TAD 边界可视化（深灰 bar，浅灰间隔）
  - 28 样本切换浏览
  - **发育时间对比**（Liver 28d vs 180d TAD 边界叠加）
  - 品种对比（TAD 数差异、边界位置差异）
  - 组织对比（Brain/Liver/Muscle TAD 边界模式差异）
  - 与 AB index 联动显示（TAD 边界常与 AB compartment 切换对应）

### 1.3 PEI（启动子-增强子互作）轨道（24 文件）
**真实文件：** `03.PEI/`，62 MB
- 24 条 8 列 TSV：chr, start, end, gene_meta, distance, score1(-log10P), score2, score3
- **可实现功能：**
  - 单样本 PEI 散点 / 折线 / 热图（按 -log10P 或 score3）
  - **PEI 锚点 → 基因关联展示**（点击 PEI 显示关联的 Ensembl 基因 ID + 距离 + P/Q-value）
  - 28 个个体样本 × 3 组织的 PEI 模式对比
  - 分辨率标签（5.5kb，UI 显示 3.5/4.5kb 时降级提示）

### 1.4 ChIP-seq 信号轨道（24 文件 = 16 Breed + 8 Tissue）
**真实文件：** `04.Chip-seq/`，3.84 GB
- **3 个 mark**：ATAC / H3K4me3 / H3K27ac
- **Tissue 8 文件**：真 BigWig（Liver/Muscle 全 3 标，Brain 缺 ATAC）
- **Breed 16 文件**：误命名 .bw（实为 bedGraph，pandas 解析）
- **可实现功能：**
  - 单信号轨道：H3K4me3 / H3K27ac / ATAC 沿基因组分布（红色 filled peaks）
  - 组织间对比（Brain/Liver/Muscle 跨组织均值叠加）
  - 品种间对比（Berkshire vs Tibetan 轨道并排）
  - 多 mark 联动（H3K4me3 + H3K27ac + ATAC 同时显示，验证启动子/增强子标记一致性）
  - Brain 缺 ATAC 时 UI 显示"无数据"标记

### 1.5 RNA-seq 信号轨道（16 文件，Muscle 错配）
**真实文件：** `05.RNA-signal/`，1 GB
- Brain（5 文件）+ Liver（6 文件）+ Muscle（5 文件，全是 Liver 副本 → UI 禁用）
- **可实现功能：**
  - 单组织 RNA 表达谱
  - **品种对比**：Berkshire vs Tibetan RNA 轨道并排
  - **正反交对比**：Maternal vs Paternal RNA 轨道并排
  - 组织间对比：Brain vs Liver（Muscle 用 mock 占位或禁用）
  - RNA + Chip-seq + AB index 联动显示（验证表达量与染色质状态关联）

### 1.6 综合多轨道叠加（核心场景）
**最常见的可视化：** 在同一基因组窗口上叠加显示
- AB index bar（20kb 分辨率）
- TAD 边界 bar
- PEI 锚点 + 关联基因标签
- RNA-seq 信号（按样本着色）
- ChIP-seq 信号（H3K4me3 / H3K27ac / ATAC，按样本着色）
- 基因模型（mock 占位 — 见 §2）

---

## 2. 现有数据不可实现，必须 mock 的功能

### 2.1 Hi-C 接触矩阵（中央热图）
**原因：** `00.HIC_contact/` 完全为空（0 文件）
**影响：** 整个浏览器的核心 2D 热图组件没有真实数据
**Mock 方案：** 按 brief.md §10 生成合成 `.mcool`（对角暖带 + TAD 块对角 + 稀疏 loop + AB 信号），种子 `sha256(chr:start:end:bin:sampleId)`，与 28 个样本一一对应
**UI 标注：** 顶部状态栏显示"MOCK DATA — awaiting Hi-C matrix"

### 2.2 Loop（CTCF-CTCF 染色质环）
**原因：** Hi-C 缺 + CTCF 缺（双重依赖）
**Mock 方案：** 在 Hi-C mock 矩阵中嵌入合成 loop 像素；UI 渲染时单独抽出 loop 弧线
**可显示：** loop 弧线 + 锚点标记

### 2.3 IS（Insulation Score）
**原因：** `02.TAD/IS_signal/` 完全为空
**可改进方案（不是 mock）：** 用 TAD boundary 数据**反推** IS 数值（基于 boundary gap 距离 + TAD 平均长度插值）
**备选 Mock：** sin/cos + Gaussian peaks

### 2.4 CTCF 蛋白结合位点
**原因：** `06.CTCF/` 完全为空
**Mock 方案：** 静态 fixture bed3，每 ~5–50kb 一行，正负链各 50%
**可显示：** CTCF motif 锚点（与 loop 锚点配合）

### 2.5 SV（结构变异）
**原因：** 无此目录
**Mock 方案：** 静态 fixture bedpe/VCF，每个样本 ~10–30 个 DEL/DUP/INV/TRA
**可显示：** SV 三角 / 断线标记

### 2.6 Gene model（基因模型轨道）
**原因：** 无 Ensembl GFF 注释
**Mock 方案：** 静态 fixture 5–10 个代表性基因
**可显示：** 基因 exon/intron + strand arrow + hover gene name

### 2.7 3D 折叠模型（Three.js 装饰）
**原因：** 5/8 参考图含此元素，但无真实三维数据
**Mock 方案：** 静态装饰几何（紫色 ribbon + 锚点 dot）
**可显示：** 与参考图视觉风格一致；不做真实三维结构重建

---

## 3. 可实现的 4 个对比维度

| 对比维度 | 真实数据支撑轨道 | 当前可立即做 |
|---|---|---|
| **组织间**（Brain/Liver/Muscle） | AB、TAD、PEI、Chip-seq、RNA（Muscle RNA 错配） | ✅ |
| **品种间**（Berkshire/Tibetan） | AB 均值、TAD、PEI、Chip-Breed、RNA | ✅ |
| **正反交间**（Maternal/Paternal） | AB Parental_mean、RNA | ✅ |
| **发育时间点**（Liver 28d/180d） | TAD（仅 6 个时间戳文件） | ✅ |

---

## 4. 总工作范围（Phase 1–7 估算）

| Phase | 范围 | 任务量 |
|---|---|---|
| **Phase 1**：骨架 + 数据管道 + 适配器 + registry | FastAPI 后端 + 6 mock 类 + 5 real 类适配器 + registry.yaml 扫描 | ~3 天 |
| **Phase 2**：令牌 + 布局 + 外壳 | tokens.css + AppShell + TopBar + LeftRail | ~1 天 |
| **Phase 3**：线性轨道（Canvas 2D） | LinearTrack × 5 kinds + HoverTooltip + 跨轨道同步 | ~2 天 |
| **Phase 4**：Hi-C mock 热图（WebGL） | HiCMatrix2D + shader + ColormapBar + mock 后端 | ~3 天 |
| **Phase 5**：叠加层 + 导航 | OverlayTracks（loop、CTCF、SV、PEI）+ 染色体选择器 | ~2 天 |
| **Phase 6**：对比模式 + 3D 模型 | SampleSelector + DiffLane + 镜像 bigwig + Three.js ribbon | ~2 天 |
| **Phase 7**：像素级扫描 | 8 demo 预设 + Playwright pixelmatch CI | ~2 天 |

**总计：~15 天**，按子代理驱动可压缩到 ~5–7 天实际工时（不计评审时间）。

---

## 5. 立即可动手的工作（Phase 1 子任务）

由于数据已就绪，**无需再等**。可以立即派发的 Phase 1 子任务：

1. **子任务 1.1**：搭建 `apps/api`（FastAPI）+ `apps/web`（Vite+React+TS）仓库骨架
2. **子任务 1.2**：实现 `scripts/build_registry.py` 自动扫描 `D:\qq\猪多组学数据\猪多组学数据\` 并输出 `data/pig-susScr11/registry.yaml`
3. **子任务 1.3**：实现 5 个 real 适配器（AB、TAD、PEI、Chip-seq、RNA-seq）— 注意 path-prefix 路由（BedGraph 误命名 .bw 分流）、chrom 归一化、Muscle RNA 显式失败
4. **子任务 1.4**：实现 6 个 mock 适配器（Hi-C、IS、Loop、CTCF、SV、Gene）— 用种子化生成
5. **子任务 1.5**：实现 8 个 FastAPI 接口（`/api/species`、`/samples`、`/hic/matrix`、`/bigwig/values`、`/bed/overlap`、`/range`、`/gene/search`、`/gene/region`）
6. **子任务 1.6**：编写 OpenAPI 文档 + 健康检查 + 单元测试

**Phase 1 完成后**：用户可在浏览器打开应用，看到左栏 28 个样本列表，切换样本加载真实 AB/TAD/PEI/Chip/RNA 轨道；Hi-C 中央热图为 mock 占位但可交互。

---

## 6. 4 个开放数据决策的当前最佳猜测

由于用户未明确回答 §8.3 的 4 个问题，建议**采用以下默认决策**，待 Phase 1 落地后再调整：

1. **assembly 命名**：暂用 `susScr11`（最常见的简写），后续用户提供确切名字后修正
2. **Muscle RNA 处置**：Phase 1 UI 灰显并标注"数据错配，等待补正"；不渲染 mock（避免误导）
3. **Breed bedGraph 误命名**：Phase 1 适配器按 path-prefix 路由（pandas 解析），不转换；后续如用户要求 BigWig 化再补
4. **PEI 多分辨率**：Phase 1 registry 标 `available_resolutions=[5.5kb]`；UI 缩放到 3.5/4.5kb 时显示"降级到 5.5kb"

---

## 7. 总结

✅ **现有数据完全足够启动开发**。核心 5 类可视化（AB、TAD、PEI、Chip-seq、RNA-seq）全部可对接真实数据；4 个对比维度（组织/品种/亲本/发育时间）均可实现。

⚠️ **必须 mock 的 6 类**（Hi-C、IS、Loop、CTCF、SV、Gene）只是**数据来源 mock**，UI 组件、交互、视觉风格不需要 mock — 与真实数据轨道用同一套组件。

📋 **下一步**：派发 Phase 1 子代理任务规格，按 6 个子任务依次实施。
