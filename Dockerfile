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

# Build the web SPA into apps/web/dist (same-origin: API serves it; auth gate on).
RUN VITE_REQUIRE_AUTH=true VITE_API_URL= pnpm --filter @mn/web build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787

EXPOSE 8787

# api start = tsx src/index.ts → runMigrations() (schema) then serves API + the web SPA.
CMD ["pnpm", "--filter", "@mn/api", "start"]
