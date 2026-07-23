# 接真实数据 — 实施方案

## 数据资产盘点（基于子代理核实）

**真实文件总数：174**
- `.bw` 40（含 24 真 BigWig + 16 文本误标）
- `.TAD` 36
- `.txt` 29（28 AB + 1 readme）
- `.200k` 28
- PEI 无扩展名 24
- `.bedgraph` 15
- `.bak` 1（忽略）

## 5 类轨道可立即接真实数据

| 类别 | 文件 | 格式 | 数量 | 工作量 |
|---|---|---|---|---|
| **AB Index** | `01.AB_compartment/*.txt` + `Breed_mean/Parental_mean/Tissue_mean/*.bedgraph` | 4 列文本（chr 数字/start/end/score）| 28 + 15 = 43 | 🟢 小：chr 归一化 + 路径映射 |
| **TAD** | `02.TAD/boundary/*.TAD` + `boundary/cut200k/*.200k` | 3-4 列文本（chr/start/end/[length]）| 36 + 28 = 64 | 🟢 小：chr 归一化 + 文件名 `.` → `_` |
| **PEI** | `03.PEI/*.keepbyFrequency`（无扩展名） | 8 列文本（chr/start/end/details/dist/-log10P/score/freq）| 24 | 🟡 中：拆 col 5 冒号分隔 |
| **RNA-seq** | `05.RNA-signal/**/*.bw` | **真 BigWig**（magic `26fc8f88`）| 24 | 🟡 中：pyBigWig + 路径映射 |
| **H3K4me3/H3K27ac** | `04.Chip-seq/Tissue/*.bw` | **真 BigWig** | 8 | 🟡 中：pyBigWig |
| **H3K4me3/H3K27ac（Breed）** | `04.Chip-seq/Breed/*.bw` | **文本 bedGraph**（误标 .bw，magic `31 09 30 09`）| 16 | 🟡 中：文本解析 |

## 5 类轨道必须继续 mock（数据缺）

| 类别 | 真实数据 | 说明 |
|---|---|---|
| Hi-C | ❌ `00.HIC_contact` 空 | 需 HiC reader + 数据 |
| Differential Hi-C | ❌ | 依赖 Hi-C |
| Insulation Score | ❌ `02.TAD/IS_signal` 空 | 需 Hi-C + cooltools 计算 |
| CTCF Loops | ❌ `06.CTCF` 空 | 需数据 |
| SV | ❌ | 需数据源 |
| Gene Annotation | ❌ | 需 Ensembl Sus scrofa GFF |
| 3D Structure | ❌ | 需真实 3D 结构数据 |

## 实施优先级

### Phase J-1 — 基础设施
- 扩展 sample registry 到 28 样本
- 修正 sample ID 命名（`Liver_TF2.28d` → `Liver_TF2_28d`）
- chr 数字 → `chr1` 归一化工具
- **不接数据**，先把管道准备好

### Phase J-2 — AB Index（最小工作量）
- 替换 mock 后端：直接读真实 .txt / .bedgraph
- 4 列 chr 数字 → `chr1` 归一化
- 28 样本路径映射
- 15 均值（Bead/Parental/Tissue）路由
- 前端无改动（mock 数据形状等价）

### Phase J-3 — TAD
- 替换 mock 后端：读真实 .TAD / .200k
- chr 归一化
- 文件名 `.` → `_` 转换
- 28 样本映射

### Phase J-4 — BigWig / 文本混合
- 安装 pyBigWig
- RNA（24 文件，全 BigWig）：路径映射 + pyBigWig.values()
- H3K4me3 / H3K27ac Tissue（8 文件 BigWig）
- H3K4me3 / H3K27ac Breed（16 文件文本）：pandas.read_csv + chr 归一化

### Phase J-5 — PEI
- 24 文件，8 列
- 拆 col 5 冒号分隔取 gene_id
- 用 col 7 (-log10P) 作为 score
- chr 已含前缀

### Phase J-6+（可选）
- 引入 Ensembl GFF 做 Gene Annotation
- 引入 Hi-C 数据后接 Hi-C / Differential / IS
- CTCF / SV 数据接入

## 关键约束

1. **样本命名不匹配**：
   - 文件：`Liver_TF2.28d.IS_split.TAD`
   - registry：`Liver_TF2_28d`
   - 需建立映射函数

2. **`.bw` 扩展名误导**：
   - RNA 全 BigWig
   - Chip-seq/Tissue BigWig
   - Chip-seq/Breed 文本
   - 路由前要 sniff magic

3. **Magic 兼容性**：
   - `26fc8f88` = UCSC BigWig（pyBigWig 原生支持）
   - `31 09 30 09` = 文本 tab-separated（不是 BigWig）

4. **chr 命名**：
   - AB / TAD 文件：纯数字（`1`）
   - PEI 文件：已含 `chr` 前缀
   - Chip-seq/Breed 文本：纯数字
   - Chip-seq/Tissue BigWig：需测试

5. **不修改前端**：前端 contract 不变（mock → real），所以 mock 删除要等真实数据通路验证后
