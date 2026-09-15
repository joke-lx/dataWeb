---
name: dataweb-db-ops
description: "dataWeb 项目的数据库与数据链路运维：连接远程 Postgres、排查“为什么显示的是 mock 数据而不是真实数据”、诊断 502/数据库连接失败、判断线上/本地真实数据源。当用户提到 dataWeb / 猪多组学浏览器 / Brain_BF3 等样本 / 真实数据 vs mock / 远程 Postgres（1.94.101.189）/ sql-harness 连接 / 本地后端连库 / Hi-C 缓存缺失 / 安全组端口 5432 / 线上站点 502 时使用。"
---

# dataWeb DB & Data-Link Ops

dataWeb 多组学三维基因组浏览器的数据库连接与数据链路排查。核心架构事实：**真实数据不走数据库**，后端直接从文件系统读取；Postgres 只承载未来 ingestion 阶段的数据，当前为空库。

## 关键架构（必读）

- 真实数据源 = 文件系统，由 `apps/api/app/real_data/registry.yaml` 定义：
  - 线上：`/root/data`（8.3G，含 `01.AB_compartment` / `02.TAD` / `03.PEI` / `04.Chip-seq` / `05.RNA-signal` / `06.CTCF` / `hic/npy`），容器内挂载为 `/data:ro`
  - 本地：`D:\qq\猪多组学数据\猪多组学数据\`（AB/TAD/PEI/RNA/ChIP 齐全；**缺 `hic/npy`**）
- 已接真实数据：AB / TAD / PEI / RNA / ChIP / Hi-C（线上）；仍为 mock：SV / CTCF loop / CTCF motif+genotype / 差异矩阵 / 3D
- 三个环境变量：`DATAWEB_DATA_ROOT`（sample_resolver 数据根）、`DATAWEB_HIC_ROOT`（hic_reader 缓存根）、`DATAWEB_DATABASE_URL`（可选 DB 层，见 `app/db.py`）
- **Windows 陷阱**：`DATAWEB_HIC_ROOT` 未设置时 registry 的 `/data/hic` 被 `pathlib.Path` 解析为 `D:\data\hic`（当前盘根），本地不存在 → Hi-C 静默回退 mock
- 样本元数据有两套表：`/api/species/pig/samples` 返回 mock 表（breed=Berkshire），registry.yaml 是真实表（Bama）——不一致是"看起来像假数据"的常见混淆源

## 排查流程

### 1. "看不到真实数据 / 显示的是 mock"

按此顺序定位，先问清用户看的是**本地（localhost:8181）还是线上（1.94.101.189）**：

1. 本地查 `D:\qq\猪多组学数据\猪多组学数据\` 对应轨道文件是否存在；线上查 `/root/data`（ssh root@1.94.101.189，key `~/.ssh/dataweb_deploy_key`）
2. Hi-C 单独查 npy 缓存：本地 `D:\data\hic\npy`（默认解析）或线上 `/root/data/hic/npy/{sample}.chr{N}.20kb.npy`
3. curl 目标 API 并**对照 mock 特征**判定真实/mock（见下）
4. 用文件内容核对：`head -5 <AB文件>`（格式：`chr  start  end  score`，如 `1 0 20000 4.689...`），与 API 返回的 score 对比

**真实 vs mock 判定基准（chr1:1Mb-3Mb bin=20kb，Brain_BF3）**：

| 数据 | mock 特征 | 真实特征 |
|---|---|---|
| AB | 分数低且规律 | 分数 2~5 量级，与文件逐位一致（如 2.901035068939119） |
| Hi-C `vmin/vmax`（log2 空间） | `3.4594 / 7.4859`（mock 生成器值） | 与 mock 不同（线上真实为 `1.685 / 7.966`） |

判定法：请求 Hi-C 后，把返回的 `X-Genomics-Vmin/Vmax` 与本地运行 `app.mock.hic_matrix()` 的输出对比，**完全一致 = mock**。

### 2. 数据库连接失败

1. 先验 TCP：`Test-NetConnection 1.94.101.189 -Port 5432`
2. 原始协议探测（区分"安全组挡数据" vs "库挂了"）：发 SSLRequest 字节 `\x00\x00\x00\x08\x04\xd2\x16\x2f`，收到 `S`/`N` 回复 = 通路正常
3. 已知坑：云安全组未放行 5432 时表现为 **SYN 通但数据被丢**（psql 报 "server closed the connection unexpectedly"，PG 日志记 `incomplete startup packet`）——先确认安全组规则（TCP 5432），已放行 0.0.0.0/0
4. 备用通道：SSH 隧道 `ssh -i ~/.ssh/dataweb_deploy_key -N -L 15432:127.0.0.1:5432 root@1.94.101.189`
5. `sql-harness test dataweb` 验证（连接定义在 `~/.config/sql-harness/connections.toml`）

### 3. 502 Bad Gateway

- 本地：`8181`（Vite）在跑但 `8000`（FastAPI）没起 → 起后端 `make api`（需带 `DATAWEB_DATABASE_URL`）
- 线上：`docker logs dataweb-web-1` 看 nginx 是否报 `connect() failed ... upstream`；api 容器起得晚时首次探测 502 会自动恢复，重试即可
- 排查命令：`Get-NetTCPConnection -LocalPort 8000/8181`（本地）、`docker ps` + `curl http://127.0.0.1/api/health`（线上）

### 4. 日常连接与启动

```bash
# sql-harness（heredoc 模式，helper 预置：query/execute/list_tables/describe/use_workspace）
sql-harness <<'PY'
use_workspace("dataweb")
print(query("SELECT version()"))
PY

# 本地后端连远程库
$env:DATAWEB_DATABASE_URL = (从 ~/.config/sql-harness/connections.toml 读 URL)
make api        # 或 apps/api/.venv 里 uvicorn app.main:app --port 8000
# 验证: curl http://localhost:8000/api/health/db  → {"database":true,...}
```

## 环境事实

服务器地址、SSH key、路径、registry 结构、端口规则、容器清单等见 **[references/topology.md](references/topology.md)**。涉密值（DB 密码）**不写入本 Skill**，一律从 `~/.config/sql-harness/connections.toml` 或服务器 `~/dataweb/.env` 读取。
