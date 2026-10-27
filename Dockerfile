# One reviewed image for API, worker, migration and SSR; credentials are never in context.
FROM node:24.22.1-trixie-slim AS base
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client ca-certificates fontconfig-config \
 && rm -rf /var/lib/apt/lists/*
FROM base AS build
ARG NPM_REGISTRY=
# Include every workspace manifest (including site modules) before npm ci.
COPY . .
RUN npm ci --no-audit --no-fund ${NPM_REGISTRY:+--registry=$NPM_REGISTRY}
RUN npm run build && npm prune --omit=dev --no-audit --no-fund
FROM base
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 43181 43182
CMD ["node", "apps/web/server.ts"]
