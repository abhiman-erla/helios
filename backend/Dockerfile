# syntax=docker/dockerfile:1

# ---- Stage 1: install production dependencies --------------------------------
# Pinned to an exact Node + Alpine version so builds are reproducible.
FROM node:24.21.0-alpine3.24 AS deps
WORKDIR /app
# Copy only the manifests first: Docker caches this layer, so `npm ci` re-runs
# only when dependencies change, not on every code change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: runtime image ---------------------------------------------------
FROM node:24.21.0-alpine3.24 AS runtime

# The app runs with `node` directly and never needs npm at runtime. Removing
# npm/npx/corepack takes their bundled dependencies out of the final filesystem,
# so they can't be abused and don't show up in Trivy scans. (It doesn't shrink
# the image: layers only add, and the files still exist in the base layer.)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations

# Files stay owned by root and read-only to the app: if the process is
# compromised it can't rewrite its own code. It runs as the unprivileged
# `node` user that ships with the image.
USER node

EXPOSE 3000

# Docker/Compose use this to mark the container healthy. (ECS relies on the
# ALB health check against the same /health route.)
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

# Exec form (JSON array) makes node PID 1, so it receives SIGTERM directly and
# the graceful shutdown in server.js runs.
CMD ["node", "src/server.js"]
