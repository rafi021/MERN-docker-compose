# syntax=docker/dockerfile:1.7
FROM oven/bun:1-alpine AS base
WORKDIR /app

# ── Stage: install prod deps only ──────────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

# ── Stage: final runtime image ─────────────────────────────────────────────────
FROM base AS release
ENV NODE_ENV=production

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Drop to non-root bun user
USER bun

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5000/record || exit 1

CMD ["bun", "run", "server.js"]
