FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@11.4.0 --ignore-scripts

WORKDIR /workspace

# Copy workspace root config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

# Copy all packages needed for the API server build
COPY lib/db/ ./lib/db/
COPY lib/api-zod/ ./lib/api-zod/
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all deps
RUN pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null || pnpm install --ignore-scripts

# Build the API server
WORKDIR /workspace/artifacts/api-server
RUN node build.mjs

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM node:22-alpine

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY --from=builder /workspace/artifacts/api-server/dist/ ./dist/
COPY --from=builder /workspace/artifacts/api-server/public/ ./dist/public/
COPY --from=builder /workspace/artifacts/api-server/migrations/ ./migrations/
COPY --from=builder /workspace/artifacts/api-server/migrate.mjs ./

RUN npm install --ignore-scripts drizzle-orm pg react react-dom

EXPOSE 8080

CMD ["sh", "-c", "node migrate.mjs && node --enable-source-maps dist/index.mjs"]
