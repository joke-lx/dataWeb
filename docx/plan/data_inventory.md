# 猪多组学数据资产盘点 — Phase 1 调整建议

**数据源：** `D:\qq\猪多组学数据\猪多组学数据\`
**生成日期：** 2026-07-19
**用于：** 调整 `docx/plan/brief.md` 与 `docx/plan/architecture.md` 中关于样本数据策略的假设

---

## 0. 结论先行（TL;DR）

- 7 个子目录中，**4 个真实可用**（01.AB、02.TAD、03.PEI、04.Chip-seq、05.RNA-signal 均为真实数据）；**3 个完全空缺**（00.HIC、02.TAD/IS_signal、06.CTCF）必须 mock。
- 关键数据质量阻断：
  - **05.RNA-signal/Muscle/ 全部 5 个文件是 Liver 副本**（contigs 与 Liver.Tissue 完全一致），Muscle RNA 不可用。
  - **04.Chip-seq/Breed/ 的 .bw 是 ASCII bedGraph 误命名**（头字节不是 BigWig magic）；**Tissue/ 是真 BigWig**。
  - 04 缺 **Brain-ATAC**；Hi-C、IS、Loop、CTCF、SV、Gene 全部缺。
- AB/TAD 染色体列纯数字（无 `chr` 前缀），与简档/IGV/UCSC 命名习惯不同，需在适配器层归一化。
- 命名空间不统一：同一 `Liver_BF3` 在 4 个目录里被表示为 `Liver_BF3` / `Liver.Berkshire` / `Liver_merged` / `Liver.Berkshire.reads.bam`，需做样本 ID 规范化。
- **建议**：Phase 1 必须把 mock 与 real 适配器同步接入，并新建 `data/registry.yaml`（path、species=pig、assembly=待确认、format、parser、status），否则 Phase 2 起的左栏样本列表与轨道元数据无法生成。

---

## 1. 数据资产全景表

| # | 文件夹 | 主要格式 | 文件数 | 大小 | indexed | 对比维度 | 真实/缺/Mock | 备注 |
|---|---|---|---|---|---|---|---|---|
| 1 | `00.HIC_contact\` | — | **0** | 0 | — | — | **缺** | 必须 mock |
| 2 | `01.AB_compartment\` | bedGraph + bin 索引 | **43** | **168 MB** | 否 | 组织/品种/亲本 | 真实 | 5 列（含 bin 索引）或 4 列均值；chrom 无前缀 |
| 3 | `02.TAD\IS_signal\` | — | **0** | 0 | — | — | **缺** | 必须 mock |
| 4 | `02.TAD\boundary\` | BED 4 列 | **37** | ~3 MB | 否 | 组织/品种/性别/发育 | 真实 | TAD_idx, chrom(纯数字), start, end |
| 5 | `02.TAD\boundary\cut200k\` | BED 5 列 | **27** | ~3 MB | 否 | 同上 | 真实 | + length；含 `*.bak` 与 `p` 非数据文件 |
| 6 | `03.PEI\` | 8 列 TSV 无表头 | **24** | **62 MB** | 否 | 组织/品种/性别/分辨率 | 真实 | 8 列，第 4 列按 `:` split；5.5kb 单一分辨率 |
| 7 | `04.Chip-seq\Breed\` | 假 .bw（实为 ASCII bedGraph） | **16** | ~0.5 GB | 否 | 组织/品种 | 真实但格式名错 | 走 pandas 解析；缺 Brain-ATAC |
| 8 | `04.Chip-seq\Tissue\` | 真 BigWig | **8** | ~3.3 GB | 是 | 组织 | 真实 | 50bp 实际 bin；Liver/Muscle 全 3 标；Brain 缺 ATAC |
| 9 | `05.RNA-signal\Brain\` | 真 BigWig | **5** | ~0.32 GB | 是 | 组织/品种/亲本 | 真实 | 5 轨：Berkshire/Tibetan/Maternal/Paternal/merged |
| 10 | `05.RNA-signal\Liver\` | 真 BigWig | **6** | ~0.37 GB | 是 | 同上 | 真实 | 6 轨 |
| 11 | `05.RNA-signal\Muscle\` | 真 BigWig | **5** | ~0.31 GB | 是 | — | **错配（=Liver）** | 5 文件全是 Liver 副本；UI 禁用 |
| 12 | `06.CTCF\` | — | **0** | 0 | — | — | **缺** | 必须 mock |
| 13 | `readme.txt` | 文本 | 1 | < 1 KB | — | — | 描述 | 唯一文档 |

**总计**：~5.1 GB，**138 个真实数据文件**，**3 个空目录**，**1 个误命名目录**（4.Breed），**1 个错配目录**（5.Muscle）。

### AB schema 警告
- `*.AB_Index.txt` 是 **5 列**：`bin_id, chrom, start, end, score`。多出来的是 bin 索引。
- `Breed_mean/`、`Parental_mean/`、`Tissue_mean/` 下的 `.bedgraph` 是 **4 列**（`chrom start end score`），无 bin 索引列。
- **两种 schema 同一目录共存，解析器需 sniff 列数。**
- 染色体名纯数字（`1, 2, 3, …`），需映射为 `chr1, chr2, …`。

---

## 2. 样本清单（按对比维度）

### 2.1 组织 × 品种 × 性别（28 unique samples）
| 组织 | Berkshire (B) | Tibetan (T) |
|---|---|---|
| Brain | F3, F4, M4, M5 (4) | F4, F5, M3, M4 (4) |
| Liver | F3, F4, F5, M2, M4, M5 (6) | F2, F4, F5, M3, M4, M5 (6) |
| Muscle | F3, F4, M4, M5 (4) | F4, F5, M3, M4 (4) |

### 2.2 亲本来源（仅 RNA + AB Parental_mean）
- Brain / Liver / Muscle 各有 Maternal vs Paternal + merged
- **Muscle RNA 数据错配，禁用**

### 2.3 发育时间（仅 Liver，28d / 180d）
- TAD：`Liver_BF3.28d/180d.IS_split.TAD`、`Liver_BM2.28d`、`Liver_TF2.28d`、`Liver_TM3.28d/180d` 共 6 文件
- AB：**未发现 28d/180d 命名的 AB_Index** → AB 发育时间对比不可用

### 2.4 品种均值
- AB：`Breed_mean/{Brain,Liver,Muscle}.{Berkshire,Tibetan}_mean_AB.bedgraph` 6 文件
- Chip-seq：`04.Chip-seq/Breed/` 16 文件

---

## 3. 各对比维度数据覆盖矩阵

| 对比维度 | Hi-C | AB | IS | TAD | PEI | Chip | RNA | CTCF | SV | Gene |
|---|---|---|---|---|---|---|---|---|---|---|
| **组织间** | ❌缺 | ✅28 样本 | ❌缺 | ✅28 样本 | ✅24 文件 | ✅24 文件 | ⚠️ Brain+Liver 真实，Muscle 错配 | ❌缺 | ❌缺 | ❌缺 |
| **品种间** | ❌缺 | ✅`Breed_mean/` 6 | — | ✅ | ✅ | ✅Berkshire vs Tibetan | ✅ | — | — | — |
| **正反交（亲本）** | ❌缺 | ✅`Parental_mean/` 6 | — | — | — | ⚠️ 仅 Breed | ✅Maternal vs Paternal | — | — | — |
| **发育时间** | ❌缺 | ❌缺 | — | ✅Liver 28d/180d | — | — | ❌缺 | — | — | — |

---

## 4. Mock 数据需求（按轨道）

| 轨道 | 来源 | 必须 mock | 建议 |
|---|---|---|---|
| **Hi-C 矩阵** | 00.HIC 空 | **全部** | 合成 `.mcool`（对角暖带、TAD 块对角、稀疏 loop、AB 信号） |
| **IS（Insulation Score）** | 02.TAD/IS_signal 空 | **全部** | 从 TAD boundary 反推，或 sin/cos + Gaussian |
| **Loop（CTCF-CTCF 环）** | Hi-C 缺 + CTCF 缺 | **全部** | 每 ~2–5Mb 选一对锚点；~50–200 loop/样本 |
| **CTCF motif / anchor** | 06.CTCF 空 | **全部** | 静态 fixture bed3；正负链各 50%；附 WebLogo |
| **SV** | 无目录 | **全部** | bedpe / VCF；~10–30 DEL/DUP/INV/TRA/样本 |
| **Gene model** | 无 | **全部** | 静态 fixture（5–10 基因）；后期对接 Ensembl GFF |
| **AB index / TAD / PEI / Chip / RNA** | 已就绪 | **无需 mock** | 直接走 real 适配器 |

**结论**：必须 mock 6 个轨道；6 个真实数据可立即对接。

---

## 5. 数据质量问题

### P0（必须立即处理）
1. **05.RNA-signal/Muscle/ 全是 Liver 副本** → UI 禁用 Muscle RNA 轨道；real 适配器抛 `DataMissingError`
2. **04.Chip-seq/Breed/ 误命名 .bw** → 适配器按 path 前缀路由（bedgraph vs bigwig）
3. **Hi-C/IS/Loop/CTCF/SV/Gene 全缺** → mock；registry 标 `status: pending`
4. **无 registry/manifest** → Phase 1 必产出 `data/registry.yaml`，由 Python 脚本扫描自动生成

### P1（建议本轮处理）
5. 染色体无 `chr` 前缀 → 适配器归一化为 `chr1..chr18`
6. AB schema 5 列 vs 4 列 → 解析器 sniff
7. PEI 缺 3.5/4.5kb → UI 降级提示
8. Chip-seq/Breed 缺 Brain-ATAC → UI 显示"无数据"
9. PEI 文件名 `*5kb*` 实际 5.5kb → registry 标 `resolution_label: 5.5kb`

### P2（延后）
10. 所有 bedGraph/TSV 未压缩未索引（API 端 binary search 即可）
11. readme 极简 → 本报告固化样本 ID → 维度映射
12. TAD cut200k 有 `*.bak` 与 `p` 非数据文件 → 扫描时显式忽略

---

## 6. 真实可立即对接的数据（按优先级）

### P0：核心三轨（AB、TAD、Chip-Tissue）
| Track | 路径示例 | 解析器 | 维度 |
|---|---|---|---|
| AB index | `…\01.AB_compartment\Liver_BF3.20kb.AB_Index.txt` | 5/4 列 sniff | 28 样本 |
| AB mean (breed) | `…\Breed_mean\Liver.Berkshire_mean_AB.bedgraph` | pandas 4 列 | 6 维度 |
| AB mean (parent) | `…\Parental_mean\Liver.Maternal_mean_AB.bedgraph` | pandas 4 列 | 6 维度 |
| AB mean (tissue) | `…\Tissue_mean\Liver.mean_AB_index.bedgraph` | pandas 4 列 | 3 维度 |
| TAD boundary | `…\02.TAD\boundary\Liver_BF3.IS_split.TAD` | pandas 4 列 | 28 样本 |
| TAD boundary 200k | `…\02.TAD\boundary\cut200k\Liver_BF3.IS_split.TAD.length.200k` | pandas 5 列 | 27 样本 |
| TAD developmental | `…\02.TAD\boundary\Liver_BF3.28d.IS_split.TAD` | pandas 4 列 | Liver 28d/180d |
| Chip H3K4me3 (tissue) | `…\04.Chip-seq\Tissue\Brain_H3K4me3.merged.bam.200bp.bw` | pyBigWig | 3 组织 |
| Chip H3K27ac (tissue) | `…\04.Chip-seq\Tissue\Liver_H3K27ac.merged.bam.200bp.bw` | pyBigWig | 3 组织 |
| Chip ATAC (tissue) | `…\04.Chip-seq\Tissue\Liver_merged_ATAC.bam.200bp.bw` | pyBigWig | 2 组织（无 Brain） |

### P1：RNA + Chip-Breed
| Track | 路径示例 | 解析器 | 备注 |
|---|---|---|---|
| RNA Brain Berkshire | `…\05.RNA-signal\Brain\Breed\Brain.Berkshire.reads.bam.50bp.bw` | pyBigWig | 50bp bin |
| RNA Brain Tibetan | `…\05.RNA-signal\Brain\Breed\Brain.Tibetan.reads.bam.50bp.bw` | pyBigWig | — |
| RNA Brain Maternal | `…\05.RNA-signal\Brain\patrental\Brain.Maternal.reads.bam.50bp.bw` | pyBigWig | 注意拼写 `patrental` |
| RNA Brain Paternal | `…\05.RNA-signal\Brain\patrental\Brain.Paternal.reads.bam.50bp.bw` | pyBigWig | — |
| RNA Brain merged | `…\05.RNA-signal\Brain\Tissue\Brain.merged.RNA_seq.bam.50bp.bw` | pyBigWig | — |
| RNA Liver × 6 轨 | `…\05.RNA-signal\Liver\…` | pyBigWig | 全 6 轨可用 |
| RNA Muscle | `…\05.RNA-signal\Muscle\…` | **禁用** | 全是 Liver 副本 |
| PEI Liver/Brain/Muscle | `…\03.PEI\{Tissue}_{B/T}{F/M}{N}.5kb.raw.PEI.xls.keep_PEIs.pick.FDR4_Dis25k.cut_0.2OE.keepbyFrequency` | 8 列解析 | 24 文件，5.5kb 单一分辨率 |
| Chip-seq Breed (误 .bw) | `…\04.Chip-seq\Breed\{Tissue}.{Breed}.{Mark}.200.bw` | **pandas 4 列** | 不走 pyBigWig |

### P2：暂不接
- Loop、CTCF、SV、Gene — 全部 mock。
- Hi-C — mock；后期 `.mcool` 多分辨率金字塔。

---

## 7. 适配器层规范

### 7.1 真实数据目录建议（用 symlink 统一入口）
```
D:\DevProjects\my\work\dataWeb\data\pig-susScr11\
  ├── registry.yaml
  ├── hic/                                  # 空（占位 + .gitkeep）
  ├── ab_index/
  │   ├── per_sample/                       # symlink → 01.AB_compartment/*.AB_Index.txt
  │   ├── mean_breed/                       # symlink → 01.AB_compartment/Breed_mean/*
  │   ├── mean_parental/                    # symlink → 01.AB_compartment/Parental_mean/*
  │   └── mean_tissue/                      # symlink → 01.AB_compartment/Tissue_mean/*
  ├── is/                                   # 空
  ├── tad/
  │   ├── boundary/                         # symlink → 02.TAD/boundary/*.IS_split.TAD
  │   ├── boundary_dev/                     # symlink → *.28d/180d.IS_split.TAD
  │   └── boundary_200k/                    # symlink → 02.TAD/boundary/cut200k/*.length.200k
  ├── pei/                                  # symlink → 03.PEI/*
  ├── chip_seq/
  │   ├── breed/                            # symlink → 04.Chip-seq/Breed/*（实为 bedgraph）
  │   ├── tissue/                           # symlink → 04.Chip-seq/Tissue/*（真 BigWig）
  │   └── manifest.yaml
  ├── rna_seq/
  │   ├── breed/                            # symlink → 05.RNA-signal/*/Breed/*
  │   ├── parental/                         # symlink → 05.RNA-signal/*/Patrental/*
  │   ├── merged/                           # symlink → 05.RNA-signal/*/Tissue/*
  │   └── .disabled/muscle/                 # 显式禁用
```

### 7.2 统一 sample_id 编码
`<Tissue>_<Breed><Sex><Individual>[_<DevStage>?]`

| 真实文件 | 规范化 sample_id |
|---|---|
| `Brain_BF3.20kb.AB_Index.txt` | `Brain_BF3` |
| `Liver_BF3.28d.IS_split.TAD` | `Liver_BF3_28d` |
| `Brain.Berkshire_mean_AB.bedgraph` | `mean(Brain, Berkshire)` |
| `Brain.Maternal_mean_AB.bedgraph` | `mean(Brain, Maternal)` |
| `Brain.merged.RNA_seq.bam.50bp.bw` | `merged(Brain)` |
| `Liver.Berkshire.reads.bam.50bp.bw` | `Liver_Berkshire` |
| `Muscle/Tissue/Liver.merged.…` | **不映射（抛 DataIntegrityError）** |

### 7.3 解析器路由规则
```
format_router(path):
  if path.parents[-3] == '04.Chip-seq/Breed' and path.suffix == '.bw':
    → format='bedgraph' (4 cols)
  elif path.suffix == '.bw':
    → format='bigwig'
  elif path.suffix in {'.bedgraph', '.bedGraph'}:
    → format='bedgraph'
  elif path.suffix in {'.txt', '.PEI', '.keepbyFrequency'}:
    → format='pei' (8 cols, col 4 split by ':')
  elif path.suffix == '.TAD':
    → format='tad' (4 cols)
  elif path.suffix == '.200k':
    → format='tad' (5 cols)

chrom_normalizer(chrom):
  return f'chr{chrom}' if not chrom.startswith('chr') else chrom
```

---

## 8. Phase 1 调整建议

### 8.1 必须修改 `brief.md` 的 7 处

| # | 章节 | 必须修改 |
|---|---|---|
| 1 | §6 文件布局 `hic/{sample}.mcool` | Hi-C 目录为**空**；mock 适配器生成；真实 `.mcool` 上线后 symlink |
| 2 | §6 `chip_seq/{sample}_{mark}.bw` 全部 BigWig | `Breed/` 实际是 bedgraph 误命名，适配器**显式分流** |
| 3 | §6 `chip_seq/{sample}_{mark}.bw` | 新增 `chip_seq/tissue/`（3 组织 × 3 marks = 8 文件，**Brain 缺 ATAC**） |
| 4 | §6 `rna_seq/{sample}.bw` | 拆为 `breed/`、`parental/`、`merged/` 三子目录；**Muscle 目录整体禁用** |
| 5 | §6 `ab_index/{sample}.bedGraph.gz` | 实际为 5 列 TSV（含 bin_id），需 sniff 列数；含三套均值 |
| 6 | §6 `tad/{sample}.bed` | 含 `boundary/`（4 列）、`cut200k/`（5 列）、开发时间样本三层 |
| 7 | §10 样本数据策略 | 新增显式 mock 列表：**Hi-C、IS、Loop、CTCF、SV、Gene**；**AB/TAD/PEI/Chip/RNA 全部走 real**；RNA Muscle 抛错 |

### 8.2 Phase 1 必加的 3 个任务

1. **`scripts/build_registry.py`** — 扫描数据根目录，输出 `data/pig-susScr11/registry.yaml`：
   ```yaml
   species: pig
   assembly: susScr11   # 待确认
   entries:
     - id: Brain_BF3
       tissue: Brain
       breed: Berkshire
       sex: F
       individual: 3
       dev_stage: adult
       files:
         ab_index: 01.AB_compartment/Brain_BF3.20kb.AB_Index.txt
         tad_boundary: 02.TAD/boundary/Brain_BF3.IS_split.TAD
         pei: 03.PEI/Brain_BF3.5kb.raw.PEI.xls.keep_PEIs.pick.FDR4_Dis25k.cut_0.2OE.keepbyFrequency
         chip_breed_H3K4me3: 04.Chip-seq/Breed/Brain.Berkshire.H3K4me3.200.bw
   status:
     hic: missing
     is: missing
     loop: missing
     ctcf: missing
     sv: missing
     gene: missing
     rna_muscle: mislabeled
   ```

2. **`apps/api/app/adapters/real_pig.py`** — 按 §7.3 路由规则实现；错配文件返 422。

3. **`apps/api/app/mock/`** — 扩充为 6 类：hic、is、loop、ctcf、sv、gene。

### 8.3 必须向用户确认的 4 个问题
1. 基因组 assembly 是 `susScr11` / `susScr11.1` / `Sscrofa11.1`？
2. Muscle RNA 是否会重新交付？若不会，Phase 1 应将 Muscle RNA 改为"显示 mock 占位"还是"不可用"？
3. `04.Chip-seq/Breed/*.bw` 真实来源是什么？需要重跑 `bedGraphToBigWig` 吗？
4. PEI 的 `*5kb*` 实际 5.5kb bin；3.5/4.5kb 是否有补充计划？

### 8.4 不需要修改的章节
- §3 四个对比维度框架保持；Muscle RNA 一项需在 demo 中标注"使用 Brain/Liver 替代"
- §5 mock 后端接口形态保持
- §9 Phase 1 完成标准"OpenAPI 列出所有接口"保持；增加"registry.yaml 校验通过"
- §11 风险表中"真实数据交接"已部分过时：5 类真实数据已就绪，只需更新描述

---

## 9. 已知未知（后续调研）
1. `02.TAD/IS_signal/` 是否历史存在过 IS 数值？
2. assembly 在仓库中未确认；需查数据根目录是否有 `genome.fa` / `*.chrom.sizes` 元数据
3. 样本 → 亲本/正反交配对方案缺失（4 BF / 4 BM / 4 TF / 4 TM 的 28d/180d 对应哪一方？）
4. `Liver/Tissue/` 同时存在 merged 与 Maternal/Paternal 文件的命名约定来源
5. `D:\qq\猪多组学数据\猪多组学数据\` 是否为唯一数据源
