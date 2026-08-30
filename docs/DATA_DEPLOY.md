# 真实组学数据部署指南

> 在云服务器上让 Brain_BF3 等样本显示真实数据（不再走 mock）需要把本地数据
> 上传到服务器的 `/data` 挂载点。本文档说明数据布局、上传步骤、以及上传后
> 怎么验证。

## 0. 环境变量 / 路径解析（重要）

后端的真实数据路径有两个，都支持环境变量覆盖：

| 数据 | 默认（registry.yaml）| 环境变量覆盖 | 本地开发推荐值 |
|---|---|---|---|
| 多组学（AB/TAD/PEI/Chip/RNA）| `DATAWEB_DATA_ROOT` 未设 → `D:\qq\猪多组学数据\猪多组学数据` | `DATAWEB_DATA_ROOT` | 同上（已默认）|
| Hi-C npy | `hic_matrix_root: /data/hic/npy` | `DATAWEB_HIC_ROOT`（指向 npy 的**父目录**）| `D:\qq\数据库\3` |

**为什么需要 `DATAWEB_HIC_ROOT`**：registry 的 `hic_matrix_root` 是容器路径
（`/data/hic`），本地开发时若环境变量未设，Hi-C reader 找不到 npy 会**静默回退 mock**
（不会报错）。本地跑后端请带：

```bash
DATAWEB_HIC_ROOT="D:\\qq\\数据库\\3" uv run --project apps/api uvicorn app.main:app --port 8000
```

容器里 `docker-compose.prod.yml` 已显式声明 `DATAWEB_HIC_ROOT: /data/hic`，
与 registry 的 `/data/hic/npy` 一致，无需额外配置。

## 1. 容器内 / 服务器上的数据布局

`docker-compose.prod.yml` 把宿主机的 `./data` 挂载到 api 容器的 `/data`（只读）。
api 进程的 `DATAWEB_DATA_ROOT=/data` 环境变量指向这个目录。

服务器上需要建好如下子目录，并填入对应内容：

| 服务器路径 | 来自本地路径 | 内容 | 大小 |
|---|---|---|---|
| `/data/01.AB_compartment/` | `D:\qq\猪多组学数据\猪多组学数据\01.AB_compartment\` | 8 个样本的 AB index（实际是 bedGraph 文本） | ~5 MB |
| `/data/02.TAD/boundary/` | `...\02.TAD\boundary\` | 8 个样本的 TAD boundary（3 列文本） | ~2 MB |
| `/data/02.TAD/boundary/cut200k/` | `...\02.TAD\boundary\cut200k\` | TAD length 200k（4 列文本） | ~1 MB |
| `/data/03.PEI/` | `...\03.PEI\` | 8 个样本的 PEI（多列文本） | ~1 MB |
| `/data/04.Chip-seq/` | `...\04.Chip-seq\` | 品种/组织的 ChIP-seq/ATAC（文本 .bw） | ~50 MB |
| `/data/05.RNA-signal/` | `...\05.RNA-signal\` | RNA-seq 覆盖度（文本 .bw） | ~50 MB |
| `/data/06.CTCF/` | `...\06.CTCF\` | **目前为空目录** — 3D/CTCF 走 mock | 0 |
| `/data/hic/npy/` | `D:\qq\数据库\3\npy\` | 转换好的 18 个 Hi-C npy | **3.4 GB** |

> **关键**：Hi-C 原始 TSV（`D:\qq\数据库\3\*.quantile`，8.6 GB）**不要上传** — 后端只读 npy 缓存。先在本地用 `scripts/convert_hic_matrix.py` 转好再上传。

## 2. 服务器上准备目录（一次）

SSH 到服务器后：

```bash
mkdir -p ~/data/{01.AB_compartment,02.TAD/boundary/cut200k,03.PEI,04.Chip-seq,05.RNA-signal,06.CTCF,hic/npy}
```

## 3. 上传数据（rsync 一次，幂等可复跑）

```bash
# 从本地 PowerShell 或 Git Bash
# 替换 <user>@<host> 为你的实际值

# 3.1 脑多组学（5 个子目录，几分钟）
rsync -avz --progress \
  "/d/qq/猪多组学数据/猪多组学数据/01.AB_compartment/" \
  user@host:~/data/01.AB_compartment/
rsync -avz --progress \
  "/d/qq/猪多组学数据/猪多组学数据/02.TAD/" \
  user@host:~/data/02.TAD/
rsync -avz --progress \
  "/d/qq/猪多组学数据/猪多组学数据/03.PEI/" \
  user@host:~/data/03.PEI/
rsync -avz --progress \
  "/d/qq/猪多组学数据/猪多组学数据/04.Chip-seq/" \
  user@host:~/data/04.Chip-seq/
rsync -avz --progress \
  "/d/qq/猪多组学数据/猪多组学数据/05.RNA-signal/" \
  user@host:~/data/05.RNA-signal/

# 3.2 Hi-C npy 缓存（3.4 GB — 文件少但单文件大,可能 10-30 分钟）
rsync -avz --progress "/d/qq/数据库/3/npy/" user@host:~/data/hic/npy/
```

**rsync 特点**：
- `-a` archive（保留权限、时间戳、递归）
- `-v --progress` 显示每个文件传输状态
- 默认走 SSH 22 端口（和 deploy.yml 同一个）
- 中断可重跑（已传的文件跳过）
- **不要把 `06.CTCF/` 也传** —— 那个目录在本地是空的；服务器上空目录即可

## 4. 验证上传

服务器上跑（用 `docker exec` 进 api 容器）：

```bash
# 4.1 文件存在性（任选几条）
docker exec dataweb-api-1 ls /data/01.AB_compartment/Brain_BF3.20kb.AB_Index.txt
docker exec dataweb-api-1 ls /data/02.TAD/boundary/Brain_BF3.IS_split.TAD
docker exec dataweb-api-1 ls /data/hic/npy/ | head    # 18 个 npy

# 4.2 健康端点
curl -s http://localhost:8000/api/health    # {"status":"ok"}

# 4.3 直接拉真实数据测一下
curl -s -D - -o /dev/null \
  "http://localhost:8000/api/hic/matrix?sample=Brain_BF3&chr=chr1&start=1000000&end=2000000&bin=20000" \
  | grep -i 'x-genomics'

# 期望:x-genomics-vmin 是 3.x 附近（真实数据；mock 固定 2.3978...）
```

## 5. 数据覆盖现状（按样本分）

### Brain_BF3（重点样本 —— 用户目标"全真实"）

| Viewer | 真实文件 | 状态 |
|---|---|---|
| Hi-C 主热图 | `hic/npy/Brain_BF3.chr1.20kb.npy` 等 18 个 | ✅ 真实 |
| AB index | `01.AB_compartment/Brain_BF3.20kb.AB_Index.txt` | ✅ 真实 |
| TAD boundary | `02.TAD/boundary/Brain_BF3.IS_split.TAD` | ✅ 真实 |
| TAD 200k | `02.TAD/boundary/cut200k/Brain_BF3.IS_split.TAD.length.200k` | ✅ 真实 |
| PEI | `03.PEI/Brain_BF3.5kb.raw.PEI.xls.keep_PEIs.pick.FDR4_Dis25k.cut_0.2OE.keepbyFrequency` | ✅ 真实 |
| RNA-seq | （无 Brain_BF3 自己的 RNA-seq 数据；走 mock） | ❌ mock |
| H3K4me3 / H3K27ac | （无 Brain_BF3 自己的 ChIP-seq 数据；走 mock） | ❌ mock |
| ATAC | 无 Brain 系列 | ❌ mock |
| 3D chromatin | 无 | ❌ mock |
| CTCF motif | `06.CTCF/` 为空 | ❌ mock |
| Differential | 无对照 | ❌ mock |
| SV (VCF) | 无 | ❌ mock |

**结论**：核心矩阵 + 注释层（TAD/PEI/AB）全真实；信号层（ChIP/RNA）因为没有 Brain_BF3 单样本的实验数据，**走 mock**（不显示误导性的品种均值）；3D/CTCF/ATAC/SV/Diff 仍 mock。

> **关于"品种均值"**：服务器上的 `04.Chip-seq/Breed/` 和 `05.RNA-signal/Brain/Breed/` 目录里有 Berkshire 脑组织多个样本的平均 H3K4me3 / RNA-seq 信号。但这些是**平均值**，不是 Brain_BF3 自己的实验数据 —— 严格来说不算 Brain_BF3 真实数据。Brain_BF3 的 registry 不引用这些均值路径，所以前端 RNA/ChIP 轨道走 mock fallback。要让 RNA/ChIP 显示真实 Brain_BF3 数据，需要为该样本单独建库测序（超出本项目范围）。

### 其他样本（Brain_BF4 / _TM4 / _BM4 等 7 个）

| Viewer | 真实文件 | 状态 |
|---|---|---|
| AB / TAD / PEI | 同 Brain_BF3 路径模式 | ✅ 真实 |
| Hi-C | 暂无（只有 Brain_BF3 的 18 个 npy） | ❌ mock |
| Chip/RNA | 仅品种/组织均值（不是单样本） | ⚠️ 走均值 fallback |
| 其余 | — | ❌ mock |

> 7 个非 BF3 样本有 AB/TAD/PEI 真实数据 + 走品种均值的 ChIP/RNA。
> 他们的 Hi-C 走 mock（因为只有 BF3 转了 npy）。

## 6. 已知技术细节（已就位，无需改）

- **大文件识别**：`bigwig_reader.sniff_format` 读前 4 字节自动判定 binary BigWig vs 文本 bedGraph。
  你的 `.bw` 文件实际是文本 bedGraph（"text_bedgraph" 分支），**不需要 pyBigWig**。
- **Hi-C npy 内存映射**：`hic_reader.load_npy` 用 `np.load(mmap_mode='r')`，
  1.8 GB chr1 不进物理 RAM，请求切到的 bin 周围页才分页加载。
- **文件查找**：所有 reader 按 `real_files[key]` 路径走，**不依赖后缀**。
  你的 `.txt` / `.TAD` / `.xls` / `.bw` 命名后缀不会影响解析。
- **mock 回退**：`hic.py` / `bigwig.py` / `bed.py` 等无真实文件时
  `FileNotFoundError` → 回退 mock，部署时**不需要全量上传也能跑**（只是没数据）。

## 7. 增量数据更新

新数据到达（如 BF3 的 Hi-C 剩余染色体补完）：

1. 本地跑 `uv run python apps/api/scripts/convert_hic_matrix.py --sample Brain_BF3`
2. rsync 新 npy 到 `~/data/hic/npy/`
3. 不需要重启 — docker-compose 的 `:ro` 挂载对文件内容变化是 hot-reload 的；
   但**新文件**需重启容器（inotify 不会触发挂载刷新），或者：
4. 直接 `docker compose exec api ls /data/hic/npy/` 验证新文件可见（mount 已生效）
5. 浏览器刷新页面 → 新染色体即可用

## 8. 故障排查

| 现象 | 排查 |
|---|---|
| `vmin=2.397895336151123`（mock 特征值） | 真实文件没找到 → `docker exec dataweb-api-1 ls /data/...` |
| 浏览器看到空 | 看 network → `/api/hic/matrix` 返回 `0,0` shape = 区间超覆盖 |
| 500 错误 | `docker logs dataweb-api-1` → 找 `FileNotFoundError` |
| `text_bedgraph` 解析全是 0 | 文件是品种均值且值为 NaN —— reader 已 nan→0 |
