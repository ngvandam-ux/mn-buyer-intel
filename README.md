# mn-buyer-intel

**Minnesota public-sector buyer intelligence.** Maps Minnesota public buyers — state
agencies, cities, counties, police/public safety, higher education, National Guard /
military offices, cooperative purchasing entities, and transit/councils — along with
their procurement offices, contacts, buying signals, and published spending priorities.
Then it matches a seller's products and services to the likely buyers and shows the
**evidence chain behind every match**, so results are transparent and auditable.

> Built Minnesota-first. The schema and connector layer are jurisdiction-agnostic — other
> states are added by writing connectors, not by redesigning the schema.

---

## Quick start

```bash
# prerequisites: Node >= 20, pnpm >= 9
pnpm install

pnpm db:migrate      # create the dev database (PGlite, file-backed under data/)
pnpm seed            # load committed real-source fixtures into the normalized schema
pnpm dev             # run the API (http://localhost:8787) + web app (http://localhost:5173)
```

No Postgres, Docker, or API keys are required for development. The dev database is
[PGlite](https://pglite.dev) — a real PostgreSQL compiled to WebAssembly that runs
in-process and stores to `data/`. Production points `DATABASE_URL` at a normal Postgres.

To refresh data live from the public sources:

```bash
pnpm capture         # live-fetch sources → fixtures/<connector-id>/<timestamp>.*
pnpm ingest          # run connectors → normalize → upsert into the DB
```

---

## What it does

1. **Ingest** public Minnesota procurement and priority data from many sources, each via
   its own connector module.
2. **Normalize** into a shared schema: entities, offices, contacts, opportunities,
   signals, categories, source documents, evidence spans, seller profiles, matches, and
   refresh jobs.
3. **Profile** a seller (capabilities, services, products, keywords, certifications,
   geography).
4. **Rank** likely buyers and opportunities by signal strength and category relevance.
5. **Explain** every match with reason strings and a link back to the exact source
   snippet that justified it.

---

## Source map

| Connector id | Source | URL | Mode | Status |
| --- | --- | --- | --- | --- |
| `mn-osp-solicitations` | OSP Solicitations & Contract Opportunities | https://mn.gov/admin/osp/vendors/solicitations-and-contract-opportunities/ | static | live |
| `mn-sourcewell` | Sourcewell solicitations | https://www.sourcewell-mn.gov/solicitations | static | live |
| `mn-supplier-portal` | MN Supplier Portal public bids (PeopleSoft) | https://guest.supplier.systems.state.mn.us/psc/fmssupap/SUPPLIER/ERP/c/SCP_PUBLIC_MENU_FL.SCP_PUB_BID_CMP_FL.GBL | browser | live |
| `mn-osp-contacts` | OSP contacts | https://mn.gov/admin/about/contact-us/state-procurement.jsp | browser | scaffold (bot-walled) |
| `mn-minnstate` | Minnesota State vendors / procurement | https://www.minnstate.edu/system/finance/procurement/index.html | static | scaffold |
| `mn-umn` | University of Minnesota suppliers | https://purchasing.umn.edu/suppliers | static | scaffold |
| `mn-mndot` | MnDOT procurement | https://www.dot.state.mn.us/ | static | scaffold (second-wave) |
| `mn-metro-council` | Metropolitan Council opportunities | https://metrocouncil.org/ | static | scaffold (second-wave) |
| `mn-natl-guard` | MN National Guard / Military Affairs | https://mn.gov/mnsmb/ | static | scaffold (second-wave) |

A **live** connector has a real parser validated against a committed fixture. A
**scaffold** implements the interface and returns no extractions until a fixture +
parser are added — it never throws, so the ingest loop stays green. See
[`CLAUDE.md`](./CLAUDE.md) for how to promote a scaffold to live.

**Fetch note:** OSP Contacts and the Supplier Portal sit behind a bot manager
(`validate.perfdrive.com`) / PeopleSoft session state, so they require Playwright. The
two static sources are fetched with plain HTTP. Fetching is deliberately low-concurrency
with caching and backoff.

---

## Data model

Eleven tables, every normalized row traceable to a source URL + extraction timestamp.

```
entities ─┬─ offices ──── contacts
          ├─ opportunities ─── signals
          ├─ categories (m:n via join)
          └─ matches ─── seller_profiles

source_documents ─── evidence_spans   (any field → exact raw snippet)
refresh_jobs                          (one row per connector run)
```

- **entities** — a buyer org. Carries `entity_type` (taxonomy below), geography, jurisdiction.
- **offices** — a procurement office within an entity.
- **contacts** — named people (office, name, title, phone, email).
- **opportunities** — solicitations / bids / contract opportunities, with dates + line items.
- **signals** — typed buying signals (taxonomy below), each linked to an entity/opportunity.
- **categories** — normalized purchasing categories; m:n to opportunities and seller profiles.
- **source_documents** — raw captured body + sha256 + url + fetched_at.
- **evidence_spans** — ties a normalized field to the exact snippet + locator in a source document.
- **seller_profiles** — the user's company: capabilities, services, products, keywords, certs, geo.
- **matches** — seller↔buyer/opportunity match with score, tier, reason strings, evidence refs.
- **refresh_jobs** — connector run status, counts, errors, timing.

**Entity taxonomy:** State agency · City · County · Police/Public Safety · Higher
Education · Military/National Guard · Cooperative Purchasing · Special District/Transit/Council.

**Signal taxonomy:** Open solicitation · Upcoming event/pre-bid/meeting · Expiring
contract · Award/historical buy · Published budget priority · Procurement policy priority
· Strategic initiative/article/newsletter · Contact exposure · Cooperative contract pathway.

### Match scoring

| Tier | Rule |
| --- | --- |
| **high** | open solicitation + named contact + matching category |
| **medium** | expiring contract or repeated history + matching entity/office |
| **low** | strategic / budget / article signal only |

Scoring is deterministic and unit-tested. Each contributing factor (category overlap,
opportunity-text match, office-name match, priority-language match, contact presence,
geography fit) produces a reason string and references the evidence span(s) that
justified it.

---

## Frontend views

1. **Dashboard** — counts, freshness, top signals, source health at a glance.
2. **Buyer Map / Entity Explorer** — MapLibre map + filterable entity list; drill into a
   buyer to see all linked opportunities, signals, contacts, and source references.
3. **Opportunities** — searchable/filterable solicitations with status and dates.
4. **Contacts** — procurement contacts by office.
5. **Signals** — typed signals with confidence and source.
6. **Seller Profile / Matching** — enter a company profile; see ranked buyer matches with
   the expandable evidence chain.
7. **Source Health / Refresh Logs** — per-connector run history, counts, and errors.

Filters across views: category search, entity type, geography, source, confidence.

---

## Architecture

pnpm monorepo. The database is the only state; connectors, ingestion, and matching are
pure functions. See [`CLAUDE.md`](./CLAUDE.md) for the full breakdown and conventions,
and [`docs/superpowers/specs/2026-06-13-mn-buyer-intel-design.md`](./docs/superpowers/specs/2026-06-13-mn-buyer-intel-design.md)
for the design spec.

```
packages/core        types, taxonomy, evidence model, scoring
packages/db          Drizzle pg-core schema + PGlite/Postgres client
packages/connectors  SourceConnector interface + per-source modules
packages/ingest      orchestrator
packages/matching    rules+keyword match engine
apps/api             Fastify REST + scheduler
apps/web             React + Vite frontend
fixtures/            committed real source snapshots
scripts/             capture / seed / ingest CLIs
```

---

## Testing

```bash
pnpm test        # vitest: parser tests (vs fixtures) + match-scoring tests
pnpm typecheck
```

---

## Roadmap

- Promote the 6 scaffold connectors to live parsers against captured fixtures.
- Enable pgvector semantic matching (the `embedding` column + driver already support it).
- Second-wave sources: State Register over-threshold, MnDOT, Met Council, National Guard
  budget/priorities, major city and county procurement pages.
- Multi-state expansion — add connectors with a new `jurisdiction`; schema unchanged.
- Hardening: per-source rate limits, conditional GET / ETag caching, robots compliance.

## Known limitations & tracked follow-ups

Surfaced by the in-repo adversarial review and consciously deferred (none affect the core
correctness verified by the test suite):

- **Ingest is not transactional per document** — a mid-run failure can leave partially
  committed rows alongside an `error` refresh job. Wrap each document's processing in a
  `db.transaction` for atomic rollback.
- **`evidence_spans.field` stores the extraction kind**, not the specific justified field
  name. Locators still pinpoint the snippet; per-field granularity is a future refinement.
- **Entity-match reasons** use the single best opportunity's reasons rather than an
  aggregated/deduped set across the buyer's qualifying opportunities.
- **No pagination** — list endpoints use hard caps (500–1000), not cursors.
- **No auth / rate limiting** — this is an internal tool. For any networked deployment,
  bind to localhost or put a shared secret + rate limiter in front of the write routes.
- Minor: derived signals are written without their own evidence span (their opportunity
  carries the evidence); the OSP/MinnState contact name for purely email-only listings is
  derived from the email local part (the email is the evidence).

## Legal / data ethics

Only publicly available information is captured, and every stored field is traceable to
its source URL and capture time. No data is fabricated. Fetching is rate-limited and
respectful. Review each source's terms before enabling production refresh.
