FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Copy lockfile and package manifest first for better cache reuse.
COPY package*.json ./

# Deterministic, production-only dependency install.
RUN npm ci --omit=dev --no-audit --fund=false

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:5000/record || exit 1

CMD ["node", "server.js"]
