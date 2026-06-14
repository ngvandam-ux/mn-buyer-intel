# CLAUDE.md — mn-buyer-intel

Minnesota public-sector buyer intelligence. Maps public buyers (state agencies, cities,
counties, police/public safety, higher ed, National Guard, cooperative purchasing,
transit/councils), their procurement offices, contacts, buying signals, and published
priorities — then matches a seller's capabilities to likely buyers with an
**explainable, auditable evidence chain**.

> Built Minnesota-first but the schema and connector layer are jurisdiction-agnostic.
> Other states drop in by adding connectors with `jurisdiction: '<ST>'` — **no schema change.**

## Golden rules

1. **No fabricated data.** Only extractable public information. Every normalized field
   must trace to a `source_document` (URL) + `extracted_at` timestamp via
   `evidence_spans`. If you can't cite it, don't store it.
2. **DB is the only state.** `connectors`, `ingest`, and `matching` are pure functions.
   Anything stateful goes through `@mn/db`.
3. **Static fetch first, Playwright only when blocked.** Adding a browser dependency to a
   source that serves static HTML is a regression.
4. **Every match is explainable.** A match with no reason strings + evidence refs is a bug.

## Architecture

pnpm monorepo. Dependency order (also the build order):

```
core → db → (connectors, matching) → ingest → api → web
```

| Package | Role | I/O? |
| --- | --- | --- |
| `@mn/core` | Types, taxonomy enums, evidence model, scoring types/utils | none (pure) |
| `@mn/db` | Drizzle `pg-core` schema, migrations, client factory | DB only |
| `@mn/connectors` | `SourceConnector` interface + static/browser infra + per-source modules | network only (no DB) |
| `@mn/ingest` | Orchestrator: connector → raw store → normalize → upsert → refresh_job | DB + connectors |
| `@mn/matching` | Rules+keyword engine → matches w/ reasons + evidence refs | reads DB via caller |
| `@mn/api` | Fastify REST + node-cron scheduler | DB |
| `@mn/web` | React + Vite + TS, 7 views | API only |

### Database

**One schema, two drivers.** Schema is Drizzle `pg-core` (canonical Postgres). Dev uses
**PGlite** (`@electric-sql/pglite`) — an in-process WASM Postgres, file-backed under
`data/` — so there is zero install and `pgvector` works in dev. Prod swaps to
`node-postgres`. Driver is chosen by `DATABASE_URL` (absent/`pglite://…` → PGlite,
`postgres://…` → node-postgres). **Do not** introduce a SQLite dialect — it would force
schema duplication.

The `opportunities.embedding` `vector` column is reserved for the future semantic layer.
It is nullable and unused by the v1 deterministic matcher.

## Source connectors

One module per source under `packages/connectors/src/sources/`, each exporting a
`SourceConnector`. Register it in `packages/connectors/src/registry.ts`.

| Connector id | Source | Mode | Status |
| --- | --- | --- | --- |
| `mn-osp-solicitations` | OSP Solicitations & Contract Opportunities | static | live |
| `mn-sourcewell` | Sourcewell solicitations | static | live |
| `mn-supplier-portal` | MN Supplier Portal (PeopleSoft) public bids | browser | live |
| `mn-osp-contacts` | OSP contacts | browser | scaffold (bot-walled) |
| `mn-minnstate` | Minnesota State vendors/procurement | static | scaffold |
| `mn-umn` | University of Minnesota suppliers | static | scaffold |
| `mn-mndot` | MnDOT procurement | static | scaffold (second-wave) |
| `mn-metro-council` | Metropolitan Council opportunities | static | scaffold (second-wave) |
| `mn-natl-guard` | MN National Guard / Military Affairs priorities | static | scaffold (second-wave) |

A connector is "live" when it has a real `parse()` validated against a committed fixture.
A "scaffold" implements the interface + returns `[]` from `parse()` until a fixture and
parser are added — it never throws, so the registry and ingest loop stay green.

### Adding a connector

1. Capture a real snapshot: `pnpm capture -- <id>` → writes `fixtures/<id>/<timestamp>.{html,json}`.
2. Write `parse()` to read that fixture in a Vitest test (`*.test.ts` next to the source).
3. Map extracted fields to `Extraction` with `evidence` spans + a `confidence` score.
4. Register in `registry.ts`. Run `pnpm test`.

## Coding conventions

- TypeScript strict, ESM only (`"type": "module"`), `verbatimModuleSyntax` — use
  `import type` for type-only imports.
- `noUncheckedIndexedAccess` is on: array/record access is `T | undefined`. Handle it.
- Cross-package imports use the package name (`@mn/core`), never deep relative paths.
- Pure functions return data; side effects (DB writes, network) live at the edges
  (`ingest`, `api`, connector `fetch`).
- Small, single-purpose files. If a file does two things, split it.
- Tests colocated as `*.test.ts`. Parser tests read committed fixtures; matcher tests use
  synthetic inputs and assert tier + exact reason strings.
- No `any` without a `// eslint-disable` + reason. Prefer `unknown` + narrowing.
- Confidence is `0..1`. Tiers are `'high' | 'medium' | 'low'`.

## Commands

```bash
pnpm install
pnpm db:migrate     # apply schema to PGlite dev DB
pnpm capture        # live-fetch sources → fixtures/ (network)
pnpm seed           # load fixtures → normalized DB
pnpm test           # vitest across packages
pnpm typecheck
pnpm dev            # migrate + seed + api + web
```

## Next steps

- Flesh out the 6 scaffold connector parsers against captured fixtures.
- Enable pgvector semantic matching (embed opportunities + seller profiles; blend
  cosine score into the deterministic matcher as an additional weighted factor + reason).
- Second-wave sources: State Register over-threshold, MnDOT, Met Council, National Guard
  budget/priorities, major city/county procurement pages.
- Multi-state: add connectors with new `jurisdiction`; the schema already supports it.
- Harden fetching (per-source rate limits, conditional GET / ETag caching, robots).
