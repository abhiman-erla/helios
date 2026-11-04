# syntax=docker/dockerfile:1

# ---- Stage 1: build the static site ------------------------------------------
FROM node:24.22.2-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: serve it with nginx ---------------------------------------------
# Only the built files (HTML/JS/CSS) ship. Node, npm and source code stay in the
# build stage, so the final image is tiny and has little to attack.
# "unprivileged" = runs as the nginx user (uid 101) on port 8080, not root.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24

# The newest base tag still ships Alpine packages with fixed HIGH/CRITICAL CVEs
# (brotli-libs, curl, libexpat). Upgrade them, then go back to the image's own
# non-root user (uid 101, read from the base image config).
USER root
RUN apk upgrade --no-cache
USER 101

# Where /api is proxied for local Compose. Unused in AWS (the ALB routes /api).
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS tells the entrypoint to read the container's
# DNS server into ${NGINX_LOCAL_RESOLVERS} for the template.
ENV BACKEND_URL=http://backend:3000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

ARG APP_VERSION=local
ENV APP_VERSION=$APP_VERSION

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
