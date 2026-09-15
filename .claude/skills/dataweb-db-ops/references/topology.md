# dataWeb 环境拓扑事实表

> 本文件为 SKILL.md 的引用资料，按需读取。涉密值（密码）不在此文件，从配置读取。

## 服务器

| 项 | 值 |
|---|---|
| 地址 | `1.94.101.189`（华为云 ECS，主机名 hcss-ecs-b2e2） |
| 用户/端口 | `root` / `22` |
| SSH key | `~/.ssh/dataweb_deploy_key`（连接命令须显式 `-i`） |
| 部署目录 | `/root/dataweb/`（docker-compose.prod.yml + .env） |
| 数据目录 | `/root/data`（8.3G，容器挂载 `/data:ro`） |
| 在线站点 | http://1.94.101.189/（nginx :80 → web，/api 反代 api :8000） |

### 线上容器（docker ps）

| 容器 | 镜像 | 端口 | 说明 |
|---|---|---|---|
| dataweb-web-1 | ghcr.io/joke-lx/dataweb-web:latest | 80→80 | nginx SPA + /api 反代 |
| dataweb-api-1 | ghcr.io/joke-lx/dataweb-api:latest | 8000 内网 | FastAPI，env: DATAWEB_DATA_ROOT=/data, DATAWEB_HIC_ROOT=/data/hic |
| dataweb-db-1 | postgres:16-alpine | 5432→5432 | dataweb/dataweb（密码在 ~/dataweb/.env） |
| guardian_radar_api | guardian-radar-api:latest | 41901→8000 | 其他项目，勿动 |
| napcat | docker.1ms.run/mlikiowa/napcat-docker | 3000/3001/6099 | 其他项目，勿动 |

## 数据库（远程 Postgres）

- 版本：PostgreSQL 16.15（postgres:16-alpine，从 `docker.1ms.run` 镜像源拉取——官方加速器 docker.xuanyuan.me 已 403 失效）
- 账号 `dataweb` / 库 `dataweb`，密码存服务器 `~/dataweb/.env`（`POSTGRES_PASSWORD`）与本地 `~/.config/sql-harness/connections.toml`
- 公网直连：`postgresql+psycopg://dataweb:<PW>@1.94.101.189:5432/dataweb`（安全组 TCP 5432 已放行 0.0.0.0/0）
- 备用：SSH 隧道 `ssh -i ~/.ssh/dataweb_deploy_key -N -L 15432:127.0.0.1:5432 root@1.94.101.189`
- 卷：`dataweb_dbdata`（docker named volume，`/var/lib/postgresql/data`）
- 状态：**空库**（仅 public schema，0 表）——真实数据不走 DB

## 本地

| 项 | 值 |
|---|---|
| 项目根 | `D:\DevProjects\my\work\dataWeb` |
| 真实数据根 | `D:\qq\猪多组学数据\猪多组学数据\`（AB/TAD/PEI/RNA/ChIP 有，**hic/npy 无**） |
| Hi-C npy 解析位置 | `DATAWEB_HIC_ROOT` 未设时 = `D:\data\hic\npy`（不存在 → mock） |
| API venv | `apps/api/.venv`（已装 fastapi/uvicorn/sqlalchemy/psycopg） |
| 本地端口 | 8000 FastAPI / 8181 Vite dev / 8080 docker compose web |
| DB 层代码 | `apps/api/app/db.py`（DATAWEB_DATABASE_URL 未设则禁用）+ `/api/health/db` 端点 |

## 数据文件结构（registry.yaml 相对 data_root）

```
01.AB_compartment/  →  {sample}.20kb.AB_Index.txt      （格式: chr start end score，无 chr 前缀、空格分隔）
02.TAD/boundary/    →  {sample}.IS_split.TAD、cut200k/ 子目录 .length.200k
03.PEI/             →  {sample}.5kb.raw.PEI.xls...
04.Chip-seq/        →  Tissue|Breed/{Tissue}_merged_*.bw
05.RNA-signal/      →  {Tissue}/{sample}*.bw
06.CTCF/
hic/npy/            →  {sample}.chr{N}.20kb.npy（float32，mmap 读取，bin 固定 20kb）
```

## 真实 vs mock 覆盖现状

| 轨道 | 线上 | 本地 | 说明 |
|---|---|---|---|
| AB / TAD / PEI / RNA / ChIP | ✅ 真实 | ✅ 真实 | 文件在 /root/data 与 D:\qq\... |
| Hi-C | ✅ 真实 | ❌ mock | 线上有 npy 缓存；本地无（修复：从服务器同步 npy 或跑 scripts/convert_hic_matrix.py） |
| SV / CTCF / 差异矩阵 / 3D | ❌ mock | ❌ mock | 项目现状（README「数据接入现状」） |

## 已踩坑记录

1. **云安全组挡 5432 数据**：表现 = TCP 握手通、发数据无响应、PG 日志 `incomplete startup packet`。放行安全组后恢复（当前已放行）
2. **Docker 镜像源失效**：daemon.json 里 docker.xuanyuan.me 返回 403；用 `docker.1ms.run/library/postgres:16-alpine` 拉取后 `docker tag` 为 `postgres:16-alpine`
3. **Windows pathlib 解析**：`Path("/data/hic")` → `D:\data\hic`（当前盘根），本地必须显式设 `DATAWEB_HIC_ROOT`
4. **compose 覆盖**：服务器 `docker-compose.prod.yml` 每次部署由 workflow SCP 覆盖，改动必须同步回本地仓库 `D:\DevProjects\my\work\dataWeb\docker-compose.prod.yml`（SHA256 比对验证）
5. **TAG 回退**：`.env` 里 `TAG=latest`；部署脚本按镜像缓存决定 SHA/latest
6. **TOML 编码**：本地写 `connections.toml` 必须 UTF-8 **无 BOM**（BOM 会被 tomllib 拒）
7. **PS heredoc**：Windows PowerShell 不支持 `<<'EOF'`，远程脚本用本地写文件 + `Get-Content -Raw | ssh host bash -s` 或 scp
