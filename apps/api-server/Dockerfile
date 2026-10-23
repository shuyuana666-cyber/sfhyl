FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api-server/package.json apps/api-server/package.json
RUN pnpm install --frozen-lockfile --filter @sfhyl/api-server...

COPY apps/api-server apps/api-server
RUN pnpm --filter @sfhyl/api-server prisma:generate \
    && pnpm --filter @sfhyl/api-server build \
    && pnpm --filter @sfhyl/api-server deploy --legacy /opt/api \
    && cd /opt/api \
    && ./node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl gosu \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/storage /app/logs \
    && chown node:node /app/storage /app/logs

COPY --from=build /opt/api ./
COPY --from=build /app/apps/api-server/dist ./dist
COPY --from=build /app/apps/api-server/prisma ./prisma
COPY public/about ./homepage-defaults
COPY public/cars ./legacy-vehicle-defaults
COPY apps/api-server/docker-entrypoint.sh ./docker-entrypoint.sh
COPY scripts/infrastructure.mjs scripts/migrate-media-to-minio.mjs scripts/migrate-media-to-local.mjs ./scripts/

ENV PATH="/app/node_modules/.bin:${PATH}"
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
EXPOSE 3002
CMD ["node", "dist/main.js"]
