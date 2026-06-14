# Deploying mn-buyer-intel

Target: **web → Netlify**, **API → Fly.io**, **Postgres+pgvector → Supabase**. Data is
seeded from the committed fixtures (offline); live refresh is run manually for now.

## 1. Supabase (database)

1. Create (or pick) a Supabase project. Note the region (Central US is closest to MN).
2. Settings → Database → Connection string → **URI** (the *direct* / session string on
   port 5432, **not** the 6543 pooler — migrations run DDL).
3. pgvector ships with Supabase; the API's migrator runs `CREATE EXTENSION IF NOT EXISTS
   vector` automatically on first boot.

## 2. Seed the production database (from your machine, offline)

```bash
# uses the committed fixtures — no scraping, no Playwright
DATABASE_URL='postgres://...supabase-direct...' pnpm db:migrate
DATABASE_URL='postgres://...supabase-direct...' pnpm seed
```

This creates the schema + pgvector and loads 19 buyers / 66 opportunities / 86 signals /
4 sample sellers.

## 3. Fly.io (API)

```bash
fly apps create mn-buyer-intel-api          # or edit `app` in fly.toml to a free name
fly secrets set \
  DATABASE_URL='postgres://...supabase-direct...' \
  BASIC_AUTH_USER='<pick-a-user>' \
  BASIC_AUTH_PASS='<pick-a-strong-pass>' \
  WEB_ORIGIN='https://<your-netlify-site>.netlify.app' \
  --app mn-buyer-intel-api
fly deploy                                   # remote builder; no local Docker needed
```

Verify: `curl https://mn-buyer-intel-api.fly.dev/api/health` → `{"ok":true}`. The data
routes return 401 without credentials (the gate is live once the secrets are set).

## 4. Netlify (web)

`netlify.toml` already builds `apps/web` and points at the Fly API. Either:

- **Git-linked (recommended):** New site from the `mn-buyer-intel` GitHub repo. Netlify
  reads `netlify.toml`. In Site settings → Environment, confirm/adjust:
  - `VITE_API_URL` = your Fly URL (default `https://mn-buyer-intel-api.fly.dev`)
  - `VITE_REQUIRE_AUTH` = `true`
- **CLI:** `netlify login` then `netlify deploy --build --prod`.

After the first deploy, set Fly's `WEB_ORIGIN` to the real Netlify URL (CORS) and redeploy
the API if it changed.

## 5. Refreshing data later

```bash
pnpm capture            # re-scrape sources → fixtures/ (needs Playwright locally)
DATABASE_URL='postgres://...' pnpm ingest    # push fresh data to prod
```

Or wire a scheduled worker with Playwright (roadmap).

## Config reference

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Fly secret + local seed | Postgres connection (absent → PGlite dev) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | Fly secret | gate the API (unset → open) |
| `WEB_ORIGIN` | Fly secret | allowed CORS origin(s), comma-separated |
| `VITE_API_URL` | Netlify env | API base baked into the SPA |
| `VITE_REQUIRE_AUTH` | Netlify env | show the sign-in gate |
| `REFRESH_CRON` | Fly secret (optional) | enable in-process scheduled refresh |
