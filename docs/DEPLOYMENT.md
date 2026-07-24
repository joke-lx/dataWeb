# 部署指南 (Deployment)

dataWeb 通过 GitHub Actions 实现 CI/CD：push 到 `main` 自动构建 Docker 镜像、推送到
GitHub Container Registry (GHCR)，再经 SSH 登录云服务器 `docker compose pull && up -d`。

## 架构

```
GitHub push main
   │
   ├─ build-push job ─ 构建 dataweb-api / dataweb-web 镜像 → 推送 ghcr.io/joke-lx/*
   │
   └─ deploy job ─ SCP docker-compose.prod.yml → 服务器
                   └─ SSH: docker compose pull + up -d + 健康检查
                                        │
                        ┌───────────────┴───────────────┐
                    web (nginx :80)                api (uvicorn :8000, 内网)
                    /        → SPA                 /api/* ← nginx 反代
```

- **web** 容器：nginx 提供 React 静态包，`/api/*` 反代到 `api` 容器（compose 网络名解析）
- **api** 容器：FastAPI + uvicorn，仅内网暴露 8000，不对公网
- **数据**：`DATAWEB_DATA_ROOT=/data`（挂载 `./data`，只读）。目录为空时真实数据读取失败并**回退 mock**，无需真实组学数据也能运行

## 需要配置的 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 添加：

| Secret 名 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `HOST` | ✅ | 云服务器公网 IP 或域名 | `123.45.67.89` |
| `USERNAME` | ✅ | SSH 登录用户名 | `root` / `ubuntu` |
| `SSH_KEY` | ✅ | SSH **私钥全文**（含 `-----BEGIN ... KEY-----`） | 见下方安全提示 |
| `PORT` | ⬜ | SSH 端口，默认 22 | `22` |

> GHCR 镜像设为 **public**，服务器拉取无需登录，因此**不需要**额外的 registry token。

### 安全地设置 SSH_KEY（不经聊天/明文粘贴）

推荐用 `gh` CLI 从密钥文件直接读入，避免私钥出现在任何聊天记录或 shell history：

```bash
# 在本地（已 gh auth login）
gh secret set SSH_KEY < ~/.ssh/dataweb_deploy_key   # 私钥文件路径
gh secret set HOST --body "123.45.67.89"
gh secret set USERNAME --body "ubuntu"
gh secret set PORT --body "22"                       # 非默认端口时才需要
```

或在 GitHub 网页端 New repository secret 手动粘贴。

## 服务器一次性准备

1. 确保已安装 Docker + Compose plugin：
   ```bash
   docker --version && docker compose version
   ```
2. 生成部署密钥对（若还没有），把公钥加入服务器：
   ```bash
   # 本地
   ssh-keygen -t ed25519 -f ~/.ssh/dataweb_deploy_key -C "dataweb-deploy"
   ssh-copy-id -i ~/.ssh/dataweb_deploy_key.pub ubuntu@<HOST>
   # 然后把私钥设为 SSH_KEY secret（见上）
   ```
3. 开放安全组 / 防火墙 **80** 端口（web）与 **22**（SSH）。
4. `~/dataweb/` 目录会由 workflow 自动创建（SCP + `mkdir -p data`），无需手动建。

首次部署前，把 GHCR 两个 package 设为 public：
`https://github.com/users/joke-lx/packages` → `dataweb-api` / `dataweb-web` → Package settings → Change visibility → Public。
（首次 push 后 package 才会出现。）

## 触发部署

- **自动**：任何合并/push 到 `main` → 自动构建 + 部署
- **手动**：Actions 页 → `Deploy` workflow → Run workflow

## 本地开发（容器）

```bash
# 构建并启动前后端容器（不含 DB，DB 为后期扩展占位）
docker compose up --build
# web → http://localhost:8080  （nginx，/api 反代到 api 容器）
```

非容器开发仍可用 `make dev`（api :8000 + web :5173）。

## 排障

```bash
# 查看部署运行状态
gh run list --workflow=Deploy
gh run watch                       # 跟踪最近一次
gh run view --log-failed           # 只看失败步骤日志

# 服务器上
ssh <USER>@<HOST>
cd ~/dataweb
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 100 -f
curl http://localhost/api/health   # 期望 {"status":"ok"}
```

| 症状 | 排查 |
|---|---|
| deploy job 卡 SCP/SSH | `HOST`/`USERNAME`/`SSH_KEY`/`PORT` secret 是否正确；安全组 22 端口 |
| `docker compose pull` 403/denied | GHCR package 未设为 public，或镜像名大小写不符（须全小写 `joke-lx`） |
| 健康检查失败 | `docker compose logs` 看 api 是否起来；pyBigWig 编译问题看构建日志 |
| web 打开 404 页面 | nginx SPA fallback（`try_files ... /index.html`）已配置，检查 dist 是否构建进镜像 |
| 端口 80 冲突 | 服务器已有服务占用 80；改 `docker-compose.prod.yml` 的 `ports` 或停用占用者 |
