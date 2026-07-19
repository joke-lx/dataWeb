# dataWeb

多组学三维基因组浏览器 — 前端可视化骨架（Task A 阶段：Monorepo 脚手架）。

## 项目简介

本项目是一个支持 6 类轨道（Hi-C、AB index、TAD 边界、PEI、bigwig、Gene model）的多组学浏览器，使用 mock 数据搭建可视化骨架，后续阶段接入真实数据。当前阶段（Task A）仅完成仓库骨架，不包含任何业务代码。

## 目录结构

```
dataWeb/
├── apps/
│   ├── api/          # FastAPI 后端空壳
│   └── web/          # Vite + React + TS 前端空壳
├── pnpm-workspace.yaml
├── Makefile
├── README.md
└── docx/             # 规划文档
```

## 启动命令

```bash
# 安装依赖
make install

# 并行启动 api + web（推荐开发时使用）
make dev

# 分别启动
make api    # FastAPI 监听 :8000
make web    # Vite 监听 :5173

# TypeScript 类型检查
make typecheck

# 清理 node_modules 与 __pycache__
make clean
```

## 技术栈

- **包管理**：pnpm 10.x（monorepo workspace）
- **前端**：Vite 5 + React 18 + TypeScript 5（strict）
- **后端**：FastAPI（Python 3.11+）+ Uvicorn
- **HTTP / API**：REST，未来接入二进制基因组响应
- **状态管理**（后续阶段引入）：Zustand 5
- **数据获取**（后续阶段引入）：TanStack Query v5
- **可视化**（后续阶段引入）：WebGL2（Hi-C）+ Canvas 2D（线性轨道）+ SVG（叠加层）

## 当前阶段

**Task A — Monorepo 脚手架**（本次提交内容）

- `pnpm-workspace.yaml` 工作区声明
- `apps/api`：FastAPI 空壳，仅暴露 `GET /api/health`
- `apps/web`：Vite + React + TS 空壳，CSS 设计令牌 (`tokens.css`)、基本 CSS 重置 (`reset.css`)
- `Makefile`：常用命令封装
- `.gitignore`：node_modules / dist / `__pycache__` / .venv / .DS_Store / *.log

下一个阶段（Task B）将在 `apps/api/app/mock/` 中加入种子化数据生成器，Task C 将引入前端应用外壳与状态管理。
