# Buyer Intelligence v2 — Org Charts, Budgets, Metro Counties, Tech Lens

- **Date:** 2026-06-14
- **Status:** Approved (design); phased implementation
- **Builds on:** the v1 vertical slice (`2026-06-13-mn-buyer-intel-design.md`)

## Goal

Make the tool "special": (1) map purchasing **decision-makers** (org charts + authority),
(2) ingest MN **budget + priority intel** tilted toward products/technology, (3) add the
**7-county metro** as buyers, and (4) surface **correlations** — decision-maker map,
budget→category fit, buyer lookalikes, and timing/cadence — all under a configurable
**products/tech focus lens**.

No fabricated data. Every field still traces to a public source + timestamp. People data
comes only from **official public** sources (agency directories, leadership pages, budget
books) — never LinkedIn or paid people-data.

## Source feasibility (recon 2026-06-14)

| Need | Source | Notes |
| --- | --- | --- |
| State budget / IT spend | MMB budget books `mn.gov/mmb-stat/documents/budget/<biennium>-biennial-budget-books/<stage>/<agency>.pdf` | per-agency PDFs; MNIT = tech goldmine ($646M→$714M IT). **PDF parsing required.** |
| Tech priorities | MNIT strategic plan `mn.gov/mnit/about-mnit/strategic-plan`; current enacted `mn.gov/mmb/budget/current-budget/current-enacted-budget/` | narrative priorities: cloud/Azure, IAM, AI, cybersecurity |
| Metro county bids | Hennepin `hennepin.procureware.com/Bids`; Ramsey + others via DemandStar; `minnesotabids.com` (BidNet) aggregator | counties use 3rd-party platforms; aggregator covers many at once |
| Org charts / people | official county/agency leadership + purchasing pages; budget books list dept heads | partial publicly → confidence-scored + review-queued |

## Phasing

The spec covers the whole v2 vision; implementation ships in slices, each independently
deployable to the live Fly app.

- **Phase 1 — Budget intel:** schema + budget connector (MMB/MNIT, PDF) + `budget_lines` +
  Budget Intel view + budget→category fit in matching.
- **Phase 2 — Metro counties + focus lens:** county entities + connectors (aggregator +
  ProcureWare/DemandStar) + the products/tech focus lens (matching + UI toggle).
- **Phase 3 — Org charts:** web-research connector + contact hierarchy/authority +
  decision-maker map.
- **Phase 4 — Correlations:** buyer lookalikes + timing/cadence + dashboards.

## A. Connector capabilities

- **PDF extraction** (`unpdf` or `pdf-parse`) added to `@mn/connectors` runtime; a
  `fetchPdf(url)` capability on `FetchContext` returning text + page offsets for evidence.
- **Budget connector** (`mn-mmb-budget`): fetch a configured set of agency budget-book PDFs
  (MNIT first, then DPS, Education, Transportation, Health, Admin) + the MNIT strategic-plan
  page. Parse → `budget_lines` (program/fund/amount/biennium) + `budget_priority` /
  `strategic_initiative` signals from narrative. Tech-relevance tagged via the category
  taxonomy.
- **Metro-county connectors:** `mn-metro-bidnet` (aggregator, multiple counties) +
  `mn-hennepin-procureware`. Seseded county entities; opportunities normalized as today.
- **Org-chart research connector** (`mn-org-charts`, Phase 3): web-research pattern —
  `discover(query)` via WebSearch → fetch official pages → parse named staff + titles +
  reporting. Confidence-scored; routed through the existing admin review queue.

## B. Schema extensions

- `contacts` += `role_category text` (what they own, e.g. `it_hardware`), `title_rank int`
  (seniority 0–100), `authority_note text` (approval scope when published),
  `reports_to_contact_id uuid` (self-FK → hierarchy), `is_decision_maker boolean`.
- new **`budget_lines`**: `id, entity_id, program text, category_keys text[], fiscal_period
  text (e.g. FY26-27), fund text, amount numeric, prior_amount numeric, trend_delta numeric,
  narrative text, source_document_id, confidence, extracted_at`.
- `entities`: county support via `entity_type = 'county'` (exists) + `metro boolean` flag +
  ensure `county` populated for grouping.
- Reuse `signals` for qualitative budget/strategic items; `budget_lines` holds the numbers.

## C. Products/tech focus lens

A named lens (`products_tech`, default on) maps category keys → weight multipliers (boost
telecom, software, it_hardware, cybersecurity, security_services, safety; demote
construction, facilities, janitorial). Lives in `@mn/core` config. The matcher multiplies
the `category` and `opportunity_text` contributions by the lens weight of the matched
categories and re-ranks. Exposed as a global UI toggle (default on); `none` lens = current
neutral behavior. Reversible, data stays complete.

## D. Correlations

- **Decision-maker map** — per entity: contacts + `reports_to` hierarchy + `role_category` +
  authority. Matching adds a factor/reason: the contact whose `role_category` matches the
  seller's category (else the senior purchasing lead) → "who to call." Org-chart panel on
  buyer detail.
- **Budget→category fit** — aggregate `budget_lines` by entity × category → a fit score +
  trend. New matching factor `budget_fit`: boost when the buyer has funded, growing budget in
  the seller's category. Reason: "FY26-27 <category> budget $Xm (+Y%)."
- **Buyer lookalikes** — per-entity vector over category presence + normalized budget + open
  opportunities → cosine similarity → top-K similar buyers. Deterministic (no ML); the
  reserved embedding column is a later upgrade. UI: "buyers like this."
- **Timing/cadence** — reach-out window from expiring-contract signals + the budget cycle
  (MN biennium starts July of odd years; new appropriations → spend window). A computed
  `reach_out` hint + sort option. Reason: "contract expires <date>; FY26 funds live."

## E. Frontend

- Global **focus-lens toggle** (header), default products/tech.
- Buyer detail: **org-chart**, **budget** (lines + trend), **similar buyers**, **reach-out
  window** panels.
- New **Budget Intel** view: agency × category spend, trends, top priorities; clickable to
  buyers/opportunities.
- Match reasons extended with decision-maker + budget-fit + timing.

## F. Data quality / ethics

- Org-chart + PDF extractions are best-effort, confidence-scored, and flow through the admin
  review queue before promotion to "trusted."
- Official public sources only for people data. Respectful fetching (low concurrency, cache,
  backoff). PDF evidence = budget-book URL + page/snippet.

## Testing

- Parser tests vs committed budget-book + county fixtures (real captures).
- `budget_lines` ingest integration test (amounts, trend, category tagging).
- Focus-lens unit tests (re-ranking, neutrality of `none`).
- Correlation unit tests (lookalike cosine, reach-out window, decision-maker selection).

## Non-goals (v2)

- No predictive/ML scoring (correlations are deterministic).
- No paid data sources. No per-contact PII beyond public name/title/work email/phone.
- Full statewide city coverage (metro counties first; cities later).
