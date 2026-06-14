# Deploying mn-buyer-intel

## Live deployment (current)

**https://mn-buyer-intel-api.fly.dev** — single-origin on **Fly.io**: the Fastify API
serves both the JSON API and the built React SPA, backed by **Fly Postgres**. Behind an
HTTP Basic Auth gate (fails closed). Credentials are in `.deploy-credentials.txt` at the
repo root (gitignored — never committed).

Why all-Fly: it deploys end-to-end with no interactive logins. The `Netlify + Fly +
Supabase` split (below) remains valid — swap `DATABASE_URL` to a Supabase string and point
a Netlify site at the API to migrate.

### Fly resources

| Resource | What |
| --- | --- |
| `mn-buyer-intel-api` | API + SPA app (2 machines, region `ord`, auto-stop when idle) |
| `mn-buyer-intel-db` | Fly Postgres, attached → sets `DATABASE_URL` secret |

Secrets on the app: `DATABASE_URL` (from attach), `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`,
`WEB_ORIGIN`.

### How it was deployed (reproduce / rebuild)

```bash
fly apps create mn-buyer-intel-api
fly postgres create --name mn-buyer-intel-db --region ord \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
fly postgres attach mn-buyer-intel-db --app mn-buyer-intel-api        # sets DATABASE_URL
fly secrets set BASIC_AUTH_USER=<u> BASIC_AUTH_PASS=<p> \
  WEB_ORIGIN=https://mn-buyer-intel-api.fly.dev --app mn-buyer-intel-api --stage
fly deploy --app mn-buyer-intel-api --remote-only
```

The Docker image builds the web SPA (same-origin, auth on) and bundles the fixtures. On
deploy, `fly.toml`'s `[deploy] release_command` runs `pnpm seed` once — applies migrations
and loads the real-fixture data + sample sellers. **Every deploy re-seeds (idempotent).**

### Operating it

```bash
fly logs   --app mn-buyer-intel-api          # tail logs
fly status --app mn-buyer-intel-api          # machines/health
fly deploy --app mn-buyer-intel-api          # ship code changes (also re-seeds)
fly secrets set KEY=val --app mn-buyer-intel-api   # rotate auth, etc.
```

Refresh data with newer source snapshots: run `pnpm capture` locally (needs Playwright),
commit the new fixtures, then `fly deploy` (the release_command re-seeds from them).

---

## Alternative: Netlify (web) + Fly (API) + Supabase (Postgres)

Original design, kept for reference. Point `DATABASE_URL` at a Supabase **direct** (5432)
connection string, build the web with `VITE_API_URL=<fly-url>` + `VITE_REQUIRE_AUTH=true`,
and deploy `apps/web/dist` to Netlify (`netlify.toml` is preconfigured). Set the API's
`WEB_ORIGIN` to the Netlify URL for CORS. Seed with
`DATABASE_URL=<supabase> pnpm db:migrate && pnpm seed` from any machine.

## Config reference

| Var | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Fly secret (auto) / local | Postgres connection (absent → PGlite dev) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | Fly secret | gate the API (unset → open) |
| `WEB_ORIGIN` | Fly secret | allowed CORS origin(s) for a split web deploy |
| `VITE_API_URL` | build env | API base baked into the SPA (empty = same-origin) |
| `VITE_REQUIRE_AUTH` | build env | show the sign-in gate |
| `REFRESH_CRON` | Fly secret (optional) | enable in-process scheduled refresh |
