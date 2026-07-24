# dataWeb Web — React/Vite build served by nginx
# Build context: repository root (needs the workspace lockfile at repo root)
#   docker build -f apps/web/Dockerfile -t dataweb-web .

# ---- Stage 1: build the static bundle ----
FROM node:20-alpine AS build
WORKDIR /repo

# Enable pnpm via corepack, pinned to a Node 20-compatible version
# (the lockfile is pnpm v10; unpinned corepack grabs latest which breaks on Node 20).
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json

# Install only the web package's dependencies.
RUN pnpm install --filter @dataweb/web... --no-frozen-lockfile

# Copy the rest of the web source and build.
COPY apps/web ./apps/web
RUN pnpm --filter @dataweb/web build

# ---- Stage 2: serve with nginx ----
FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
