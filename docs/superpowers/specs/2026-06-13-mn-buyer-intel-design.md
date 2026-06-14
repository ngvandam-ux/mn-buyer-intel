# MN Public-Sector Buyer Intelligence — Design Spec

- **Date:** 2026-06-13
- **Status:** Approved (v1 vertical slice)
- **Codename:** `mn-buyer-intel`

## 1. Goal

Map Minnesota public buyers, procurement offices, contacts, buying signals, and
published spending priorities; then match a seller's products/services to likely
buyers with an **explainable, auditable evidence chain** for every match.

Minnesota first, but the schema and connector architecture are jurisdiction-agnostic
so other states drop in without redesign.

## 2. Scope (v1 = full vertical slice)

End-to-end runnable application:

- Full normalized schema (11 tables) with full source traceability.
- Connector/adapter layer with a single `SourceConnector` interface; **3 live
  connectors** (OSP Solicitations, Sourcewell, MN Supplier Portal) plus **6
  scaffolds** (OSP Contacts, Minnesota State, UMN, and second-wave sources) on the
  same interface.
- Ingestion orchestrator: raw capture → normalize → upsert → refresh-job record.
- Signal extraction across the 9-type taxonomy.
- Deterministic rules + keyword/category matching engine with reason strings and
  evidence references.
- React frontend with all 7 views.
- Scheduled refresh, source-health view, admin review queue.

Out of scope for v1 (designed-for, not built): semantic embeddings/pgvector search
(column reserved, no-op until enabled), full second-wave connector parsers (scaffolds
in place), multi-tenant auth.

## 3. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Data sourcing | Capture real snapshots during build; commit as fixtures + seed | No fabrication, reproducible, deterministic parser tests, offline-runnable |
| Database | Drizzle ORM, **single `pg-core` schema**. Dev = PGlite (in-process WASM Postgres, file-backed). Prod = node-postgres | Zero-install dev that *is* Postgres → no dialect duplication; pgvector works in dev too |
| Matching | Rules + keyword/category, deterministic | Matches the "explainable evidence" requirement exactly; no API keys; fully testable. pgvector hooks reserved |
| Fetch strategy | Static (undici + cheerio) by default; Playwright only where blocked/JS | OSP Solicitations + Sourcewell are static; OSP Contacts + Supplier Portal are bot-protected / PeopleSoft Fluid |
| Frontend | React + Vite + TypeScript, MapLibre map | User's stack; lean |
| API | Fastify (Node + TS) | Thin REST over DB; fn-based scheduler swappable to a queue |

### Source reachability probe (2026-06-13)

| Source | Result | Fetch mode |
| --- | --- | --- |
| OSP Solicitations | HTTP 200 static HTML | static |
| Sourcewell Solicitations | HTTP 200 static HTML | static |
| OSP Contacts (`.jsp`) | Redirect to `validate.perfdrive.com` (Radware/ShieldSquare bot wall) | browser (Playwright) |
| MN Supplier Portal | PeopleSoft Fluid (JS + session state) | browser (Playwright) |

## 4. Architecture

pnpm monorepo. DB is the **only** state; connectors / ingest / matching are pure
functions. Refresh = a scheduler calling `runConnector(id)`; swap node-cron for
BullMQ / Temporal later with no logic change.

```
mn-buyer-intel/
├─ packages/
│  ├─ core/        # types, taxonomy enums, evidence model, scoring types/utils — pure TS, no I/O
│  ├─ db/          # Drizzle pg-core schema + migrations; PGlite (dev) / node-postgres (prod) client
│  ├─ connectors/  # SourceConnector interface + static/browser infra + per-source modules
│  ├─ ingest/      # orchestrator: connector → raw store → normalize → upsert → refresh_job
│  └─ matching/    # rules+keyword engine → matches w/ reason strings + evidence refs
├─ apps/
│  ├─ api/         # Fastify REST + node-cron scheduler
│  └─ web/         # React + Vite + TS, 7 views
├─ fixtures/       # real captured source snapshots (committed)
└─ scripts/        # capture-fixtures, seed, migrate
```

### Dependency order (build spine first, then fan out)

`core` → `db` → (`connectors`, `matching`) → `ingest` → `api` → `web`.
`connectors`, `matching`, and the 7 web views are independent leaves once the
contracts in `core`/`db` are fixed.

## 5. Connector interface (reusable core)

```ts
interface SourceConnector {
  id: string;                       // 'mn-osp-solicitations'
  meta: {
    url: string;
    jurisdiction: string;           // 'MN' — other states reuse with no schema change
    entityHint: EntityType;
    fetchMode: 'static' | 'browser';
    sourceName: string;
  };
  fetch(ctx: FetchContext): Promise<RawDocument[]>;     // raw html/json + url + fetchedAt + sha256
  parse(raw: RawDocument): Promise<Extraction[]>;        // structured + evidence + confidence + partial
}
```

- `RawDocument` = `{ url, fetchedAt, contentType, body, sha256 }` → persisted to `source_documents` verbatim.
- `Extraction` = `{ kind: 'opportunity'|'contact'|'office'|'signal'|'entity', fields, evidence: EvidenceSpan[], confidence: number, partial: boolean }`.
- `EvidenceSpan` = `{ locator, rawSnippet, extractedAt }` → persisted to `evidence_spans`, FK to `source_documents`.
- Static connectors use `undici` + `cheerio`; browser connectors use a shared, pooled, low-concurrency Playwright context.

## 6. Normalized schema (11 tables)

`entities, offices, contacts, opportunities, signals, categories, source_documents,
evidence_spans, seller_profiles, matches, refresh_jobs`.

Traceability: every normalized row carries `source_document_id`, `extracted_at`,
`confidence`. `evidence_spans` ties any field to a raw snippet. `source_documents`
keeps raw body + sha256 + url + fetched_at.

- **Entity taxonomy:** State agency · City · County · Police/Public Safety · Higher Education · Military/National Guard · Cooperative Purchasing · Special District/Transit/Council.
- **Signal taxonomy:** Open solicitation · Upcoming event/pre-bid/meeting · Expiring contract · Award/historical buy · Published budget priority · Procurement policy priority · Strategic initiative/article/newsletter · Contact exposure · Cooperative contract pathway.
- Geography: county/city + optional lat/lng.
- `opportunities.embedding` nullable `vector` column reserved for the future semantic layer (no-op until enabled).

## 7. Matching logic (deterministic, explainable)

Seller profile tokenized (capabilities, services, products, keywords, certifications,
geography). Each opportunity/entity scored on weighted factors:

- category overlap
- opportunity-text match
- office / entity name match
- priority-language match
- contact presence
- geography fit

**Tier rule (per requirements):**

- `high` = open solicitation + named contact + matching category
- `medium` = expiring contract or repeated history + matching entity/office
- `low` = strategic / budget / article signal only

**Every contributing factor emits a human-readable reason string and links the
evidence span(s) that justified it.** Result is a fully auditable chain. Unit-tested
on tier assignment and exact reason output.

## 8. Frontend (7 views)

Dashboard · Buyer Map / Entity Explorer · Opportunities · Contacts · Signals · Seller
Profile / Matching · Source Health / Refresh Logs.

- Category search; filters by entity type, geography, source, confidence.
- Buyer drill-down → linked opportunities, signals, contacts, and source references.
- Seller → ranked buyer matches with an expandable evidence chain.
- MapLibre map of MN entities (optional coords).

## 9. Refresh / health / admin

`refresh_jobs` records each connector run (status, started, finished, counts, errors)
→ Source Health view. Admin review queue surfaces low-confidence / partial extractions
for human accept/reject before they promote to trusted.

## 10. Testing

Vitest. Parser tests against committed real fixtures. Match-scoring tests assert tier
+ exact reason strings on synthetic seller/opportunity inputs. Connector contract
tests (interface conformance + sha256 stability).

## 11. Roadmap

- **Phase 1 (this build):** schema + adapters + raw ingestion + normalized entities.
- **Phase 2 (this build):** signal extraction + matching + evidence.
- **Phase 3 (this build):** frontend explorer + seller match workflows.
- **Phase 4 (this build):** scheduled refresh + source health + admin review queue.
- **Next:** flesh out 6 scaffold connectors with real parsers; enable pgvector
  semantic matching; second-wave sources (State Register, MnDOT, Met Council, National
  Guard, major cities/counties); multi-state expansion (set `jurisdiction`, add
  connectors — no schema change).

## 12. Non-goals / guardrails

- No fabricated data — only extractable public information, every field traceable to
  a source URL + extraction timestamp.
- Respectful fetching: low concurrency, response caching, backoff, honor robots where
  applicable.
