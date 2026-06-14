# API image for Fly.io. Runs the monorepo via tsx (same runtime as dev) — no dist build
# step, no Playwright browsers (prod refresh is manual; static connectors still work).
FROM node:22-slim

RUN corepack enable && \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install with the full workspace present so the frozen lockfile resolves.
COPY . .
RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    PGLITE_DATA=/data/pglite

EXPOSE 8787

# api start = tsx src/index.ts → runMigrations() (creates pgvector + schema) then serves.
CMD ["pnpm", "--filter", "@mn/api", "start"]
