FROM node:22-alpine AS builder

RUN npm install -g pnpm@11.4.0 --ignore-scripts

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./
COPY lib/db/ ./lib/db/
COPY lib/api-zod/ ./lib/api-zod/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm install --ignore-scripts

WORKDIR /workspace/artifacts/api-server
RUN node build.mjs

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM node:22-alpine

# Keep the EXACT same path as the build stage so pino worker paths resolve
WORKDIR /workspace/artifacts/api-server

COPY --from=builder /workspace/artifacts/api-server/dist/ ./dist/
COPY --from=builder /workspace/artifacts/api-server/public/ ./dist/public/
COPY artifacts/api-server/migrations/ ./migrations/
COPY artifacts/api-server/migrate.mjs ./

RUN npm install --ignore-scripts drizzle-orm pg

EXPOSE 8080

CMD ["sh", "-c", "node migrate.mjs && node --enable-source-maps dist/index.mjs"]
