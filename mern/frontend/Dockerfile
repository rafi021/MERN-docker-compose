# syntax=docker/dockerfile:1.7
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ── Stage: install all deps (dev included for build tools) ─────────────────────
FROM base AS deps
# Cypress binary is not needed for a production build artifact
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ── Stage: build Vite app ──────────────────────────────────────────────────────
FROM base AS builder
ENV CYPRESS_INSTALL_BINARY=0

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BASE_URL=http://backend:5000
ENV VITE_BASE_URL=$VITE_BASE_URL

RUN bun run build

# ── Stage: serve with Nginx ────────────────────────────────────────────────────
FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
