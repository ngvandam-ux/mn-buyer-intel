/**
 * Query layer — turns DB rows into the API DTOs the frontend consumes. Keeps routes thin.
 */

import type {
  BudgetIntelDTO,
  BudgetLineView,
  ContactListItem,
  DashboardDTO,
  EntityDetail,
  ReachOut,
  SimilarBuyer,
  EntityListItem,
  EvidenceRef,
  MatchResults,
  MatchView,
  OpportunityDetail,
  OpportunityListItem,
  SignalListItem,
  SourceHealth,
} from '@mn/core';
import type { Signal } from '@mn/core';
import { CATEGORY_TAXONOMY, DEFAULT_FOCUS, categoryLabel, categoryNaics, cosineSimilarity, lensWeightForCategories, sharedKeys } from '@mn/core';
import type { BudgetLineRow } from '@mn/db';
import { CONNECTORS } from '@mn/connectors';
import {
  type AppDatabase,
  and,
  budgetLines,
  categories,
  contacts,
  count,
  desc,
  entities,
  eq,
  evidenceSpans,
  ilike,
  inArray,
  isNotNull,
  offices,
  opportunities,
  refreshJobs,
  sellerProfiles,
  signals,
  sourceDocuments,
  sql,
} from '@mn/db';

const num = (v: unknown): number => Number(v ?? 0);

/** Escape LIKE/ILIKE metacharacters so user search text is treated literally. */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export async function resolveEvidence(db: AppDatabase, targetIds: string[]): Promise<EvidenceRef[]> {
  const ids = [...new Set(targetIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: evidenceSpans.id,
      targetId: evidenceSpans.targetId,
      field: evidenceSpans.field,
      locator: evidenceSpans.locator,
      rawSnippet: evidenceSpans.rawSnippet,
      extractedAt: evidenceSpans.extractedAt,
      sourceDocumentId: evidenceSpans.sourceDocumentId,
      sourceUrl: sourceDocuments.url,
      sourceConnectorId: sourceDocuments.connectorId,
      fetchedAt: sourceDocuments.fetchedAt,
    })
    .from(evidenceSpans)
    .leftJoin(sourceDocuments, eq(evidenceSpans.sourceDocumentId, sourceDocuments.id))
    .where(inArray(evidenceSpans.targetId, ids));
  return rows.map((r) => ({
    id: r.id,
    targetId: r.targetId,
    field: r.field,
    locator: r.locator,
    rawSnippet: r.rawSnippet,
    extractedAt: r.extractedAt,
    sourceDocumentId: r.sourceDocumentId,
    sourceUrl: r.sourceUrl ?? '',
    sourceConnectorId: r.sourceConnectorId ?? '',
    fetchedAt: r.fetchedAt ?? r.extractedAt,
  }));
}

// ---------------------------------------------------------------------------
// Opportunities
// ---------------------------------------------------------------------------

const OPP_SELECT = {
  id: opportunities.id,
  title: opportunities.title,
  status: opportunities.status,
  postedDate: opportunities.postedDate,
  dueDate: opportunities.dueDate,
  url: opportunities.url,
  solicitationType: opportunities.solicitationType,
  businessUnit: opportunities.businessUnit,
  categoryKeys: opportunities.categoryKeys,
  confidence: opportunities.confidence,
  entityId: opportunities.entityId,
  entityName: entities.name,
  entityType: entities.entityType,
} as const;

export interface OpportunityFilters {
  status?: string;
  category?: string;
  q?: string;
  source?: string;
  entityType?: string;
  entityId?: string;
  minConfidence?: number;
  limit?: number;
  /** Focus lens to rank by (default products_tech). */
  lens?: string;
}

export async function listOpportunities(
  db: AppDatabase,
  f: OpportunityFilters = {},
): Promise<OpportunityListItem[]> {
  const conds = [];
  if (f.status) conds.push(eq(opportunities.status, f.status as never));
  if (f.category) conds.push(sql`${f.category} = any(${opportunities.categoryKeys})`);
  if (f.q) conds.push(ilike(opportunities.title, `%${escapeLike(f.q)}%`));
  if (f.entityType) conds.push(eq(entities.entityType, f.entityType as never));
  if (f.entityId) conds.push(eq(opportunities.entityId, f.entityId));
  if (typeof f.minConfidence === 'number') conds.push(sql`${opportunities.confidence} >= ${f.minConfidence}`);
  if (f.source) conds.push(eq(sourceDocuments.connectorId, f.source));

  const base = db.select(OPP_SELECT).from(opportunities).leftJoin(entities, eq(opportunities.entityId, entities.id));
  const withSource = f.source
    ? base.leftJoin(sourceDocuments, eq(opportunities.sourceDocumentId, sourceDocuments.id))
    : base;
  const rows = (await withSource
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(opportunities.dueDate))
    .limit(f.limit ?? 500)) as OpportunityListItem[];

  // Re-rank by the focus lens (tech/products first), stable within equal weight by due date.
  const lens = f.lens ?? DEFAULT_FOCUS;
  if (lens !== 'none') {
    rows.sort((a, b) => lensWeightForCategories(lens, b.categoryKeys) - lensWeightForCategories(lens, a.categoryKeys));
  }
  return rows;
}

export async function getOpportunityDetail(
  db: AppDatabase,
  id: string,
): Promise<OpportunityDetail | null> {
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  if (!opp) return null;
  const entity = opp.entityId
    ? (await db.select().from(entities).where(eq(entities.id, opp.entityId)).limit(1))[0] ?? null
    : null;
  const office = opp.officeId
    ? (await db.select().from(offices).where(eq(offices.id, opp.officeId)).limit(1))[0] ?? null
    : null;
  const sigConds = [eq(signals.opportunityId, id)];
  const sigs = await db
    .select()
    .from(signals)
    .where(opp.entityId ? sql`${signals.opportunityId} = ${id} or ${signals.entityId} = ${opp.entityId}` : and(...sigConds));
  const cats = opp.categoryKeys.length
    ? await db.select().from(categories).where(inArray(categories.key, opp.categoryKeys))
    : [];
  const evidence = await resolveEvidence(db, [id]);
  return { opportunity: opp, entity, office, signals: sigs, categories: cats, evidence };
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface EntityFilters {
  entityType?: string;
  q?: string;
  jurisdiction?: string;
  category?: string;
}

export async function listEntities(db: AppDatabase, f: EntityFilters = {}): Promise<EntityListItem[]> {
  const conds = [];
  if (f.entityType) conds.push(eq(entities.entityType, f.entityType as never));
  if (f.jurisdiction) conds.push(eq(entities.jurisdiction, f.jurisdiction));
  if (f.q) conds.push(ilike(entities.name, `%${escapeLike(f.q)}%`));
  const ents = await db
    .select()
    .from(entities)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(entities.name)
    .limit(1000);

  const oppCounts = await db
    .select({ entityId: opportunities.entityId, n: count() })
    .from(opportunities)
    .groupBy(opportunities.entityId);
  const sigCounts = await db
    .select({ entityId: signals.entityId, n: count() })
    .from(signals)
    .groupBy(signals.entityId);
  const conCounts = await db
    .select({ entityId: contacts.entityId, n: count() })
    .from(contacts)
    .groupBy(contacts.entityId);

  const oppMap = new Map(oppCounts.map((r) => [r.entityId, num(r.n)]));
  const sigMap = new Map(sigCounts.map((r) => [r.entityId, num(r.n)]));
  const conMap = new Map(conCounts.map((r) => [r.entityId, num(r.n)]));

  let list: EntityListItem[] = ents.map((e) => ({
    ...e,
    opportunityCount: oppMap.get(e.id) ?? 0,
    signalCount: sigMap.get(e.id) ?? 0,
    contactCount: conMap.get(e.id) ?? 0,
  }));

  if (f.category) {
    const matchingOppEntityIds = new Set(
      (
        await db
          .select({ entityId: opportunities.entityId })
          .from(opportunities)
          .where(sql`${f.category} = any(${opportunities.categoryKeys})`)
      )
        .map((r) => r.entityId)
        .filter(Boolean) as string[],
    );
    list = list.filter((e) => matchingOppEntityIds.has(e.id));
  }
  return list;
}

export async function getEntityDetail(db: AppDatabase, id: string): Promise<EntityDetail | null> {
  const [entity] = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  if (!entity) return null;
  const [offs, cons, opps, sigs, budgets] = await Promise.all([
    db.select().from(offices).where(eq(offices.entityId, id)),
    db.select().from(contacts).where(eq(contacts.entityId, id)),
    listOpportunities(db, { entityId: id }),
    db.select().from(signals).where(eq(signals.entityId, id)).orderBy(desc(signals.strength)),
    db.select().from(budgetLines).where(eq(budgetLines.entityId, id)).orderBy(desc(budgetLines.amount)),
  ]);
  const targetIds = [
    id,
    ...offs.map((o) => o.id),
    ...cons.map((c) => c.id),
    ...opps.map((o) => o.id),
    ...sigs.map((s) => s.id),
    ...budgets.map((b) => b.id),
  ];
  const [evidence, similar] = await Promise.all([resolveEvidence(db, targetIds), getSimilarBuyers(db, id)]);
  const reachOut = computeReachOut(opps, sigs, budgets);
  return {
    entity,
    offices: offs,
    contacts: cons,
    opportunities: opps,
    signals: sigs,
    budgetLines: budgets,
    reachOut,
    similar,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Correlations — buyer lookalikes + reach-out timing (v4)
// ---------------------------------------------------------------------------

/** Buyers that buy/fund the same categories (cosine over category-exposure vectors). */
export async function getSimilarBuyers(db: AppDatabase, entityId: string, limit = 5): Promise<SimilarBuyer[]> {
  const [oppRows, budgetRows, entRows] = await Promise.all([
    db.select({ entityId: opportunities.entityId, cats: opportunities.categoryKeys }).from(opportunities),
    db.select({ entityId: budgetLines.entityId, cats: budgetLines.categoryKeys }).from(budgetLines),
    db.select({ id: entities.id, name: entities.name, entityType: entities.entityType }).from(entities),
  ]);
  const vecs = new Map<string, Map<string, number>>();
  const add = (eid: string | null, cats: string[], w: number) => {
    if (!eid) return;
    const m = vecs.get(eid) ?? new Map<string, number>();
    for (const c of cats) m.set(c, (m.get(c) ?? 0) + w);
    vecs.set(eid, m);
  };
  for (const o of oppRows) add(o.entityId, o.cats, 1);
  for (const b of budgetRows) add(b.entityId, b.cats, 2);

  const target = vecs.get(entityId);
  if (!target) return [];
  const entById = new Map(entRows.map((e) => [e.id, e]));
  const scored: SimilarBuyer[] = [];
  for (const [eid, vec] of vecs) {
    if (eid === entityId) continue;
    const s = cosineSimilarity(target, vec);
    if (s <= 0) continue;
    const e = entById.get(eid);
    if (!e) continue;
    scored.push({
      entityId: eid,
      entityName: e.name,
      entityType: e.entityType,
      score: Math.round(s * 100) / 100,
      sharedCategories: sharedKeys(target, vec).slice(0, 6),
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** When to reach out: budget cycle + expiring contracts + opportunity due dates. */
function computeReachOut(
  opps: OpportunityListItem[],
  sigs: Signal[],
  budgets: BudgetLineRow[],
): ReachOut {
  const now = Date.now();
  const DAY = 86_400_000;
  const openSoon = opps.some(
    (o) => o.status === 'open' && o.dueDate && new Date(o.dueDate).getTime() - now < 30 * DAY && new Date(o.dueDate).getTime() > now,
  );
  const hasOpen = opps.some((o) => o.status === 'open');
  const expiring = sigs.some((s) => s.signalType === 'expiring_contract');
  const fundedNow = budgets.some((b) => (b.fiscalPeriod ?? '').includes('2026-27'));
  if (openSoon) return { window: 'now', label: 'Open solicitation closing within 30 days — respond now' };
  if (expiring) return { window: 'now', label: 'Contract expiring — re-bid window is open' };
  if (fundedNow) return { window: 'now', label: 'FY2026-27 appropriations are live — budget available to spend now' };
  if (hasOpen) return { window: 'soon', label: 'Active solicitation posted — engage now' };
  if (budgets.length > 0 || sigs.length > 0) return { window: 'monitor', label: 'Funded/strategic interest — monitor for solicitations' };
  return { window: 'monitor', label: 'No active timing signal yet' };
}

// ---------------------------------------------------------------------------
// Contacts + signals
// ---------------------------------------------------------------------------

export async function listContacts(
  db: AppDatabase,
  f: { q?: string; entityId?: string } = {},
): Promise<ContactListItem[]> {
  const conds = [];
  if (f.entityId) conds.push(eq(contacts.entityId, f.entityId));
  if (f.q) conds.push(ilike(contacts.name, `%${escapeLike(f.q)}%`));
  const rows = await db
    .select({
      contact: contacts,
      entityName: entities.name,
      officeName: offices.name,
    })
    .from(contacts)
    .leftJoin(entities, eq(contacts.entityId, entities.id))
    .leftJoin(offices, eq(contacts.officeId, offices.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(contacts.name)
    .limit(1000);
  return rows.map((r) => ({ ...r.contact, entityName: r.entityName, officeName: r.officeName }));
}

export async function listSignals(
  db: AppDatabase,
  f: { type?: string; entityId?: string; q?: string } = {},
): Promise<SignalListItem[]> {
  const conds = [];
  if (f.type) conds.push(eq(signals.signalType, f.type as never));
  if (f.entityId) conds.push(eq(signals.entityId, f.entityId));
  if (f.q) conds.push(ilike(signals.title, `%${escapeLike(f.q)}%`));
  const rows = await db
    .select({
      signal: signals,
      entityName: entities.name,
      opportunityTitle: opportunities.title,
    })
    .from(signals)
    .leftJoin(entities, eq(signals.entityId, entities.id))
    .leftJoin(opportunities, eq(signals.opportunityId, opportunities.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(signals.strength))
    .limit(1000);
  return rows.map((r) => ({ ...r.signal, entityName: r.entityName, opportunityTitle: r.opportunityTitle }));
}

// ---------------------------------------------------------------------------
// Categories, sources, refresh jobs, review queue
// ---------------------------------------------------------------------------

export async function listCategories(
  db: AppDatabase,
): Promise<Array<{ key: string; label: string; count: number; naics: string[] }>> {
  const counts = await db
    .select({ key: sql<string>`unnest(${opportunities.categoryKeys})`, n: count() })
    .from(opportunities)
    .groupBy(sql`unnest(${opportunities.categoryKeys})`);
  const map = new Map(counts.map((r) => [r.key, num(r.n)]));
  return CATEGORY_TAXONOMY.map((c) => ({
    key: c.key,
    label: c.label,
    count: map.get(c.key) ?? 0,
    naics: categoryNaics(c.key),
  }));
}

export async function getSourceHealth(db: AppDatabase): Promise<SourceHealth[]> {
  const jobs = await db.select().from(refreshJobs).orderBy(desc(refreshJobs.createdAt));
  const latestByConnector = new Map<string, (typeof jobs)[number]>();
  for (const j of jobs) if (!latestByConnector.has(j.connectorId)) latestByConnector.set(j.connectorId, j);
  return CONNECTORS.map((c) => ({
    id: c.meta.id,
    sourceName: c.meta.sourceName,
    url: c.meta.url,
    jurisdiction: c.meta.jurisdiction,
    entityHint: c.meta.entityHint,
    fetchMode: c.meta.fetchMode,
    live: c.meta.live,
    description: c.meta.description ?? null,
    lastJob: latestByConnector.get(c.meta.id) ?? null,
  }));
}

export async function listRefreshJobs(db: AppDatabase, limit = 50) {
  return db.select().from(refreshJobs).orderBy(desc(refreshJobs.createdAt)).limit(limit);
}

/** Low-confidence or partial records awaiting human review. */
export async function getReviewQueue(db: AppDatabase, threshold = 0.7) {
  const opps = await db
    .select(OPP_SELECT)
    .from(opportunities)
    .leftJoin(entities, eq(opportunities.entityId, entities.id))
    .where(sql`${opportunities.confidence} < ${threshold}`)
    .limit(200);
  const cons = await db
    .select({ contact: contacts, entityName: entities.name })
    .from(contacts)
    .leftJoin(entities, eq(contacts.entityId, entities.id))
    .where(sql`${contacts.confidence} < ${threshold}`)
    .limit(200);
  return {
    opportunities: opps as OpportunityListItem[],
    contacts: cons.map((r) => ({ ...r.contact, entityName: r.entityName, officeName: null })),
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboard(db: AppDatabase): Promise<DashboardDTO> {
  const [
    [entityCount],
    [oppCount],
    [openOppCount],
    [contactCount],
    [signalCount],
    [sellerCount],
    entitiesByType,
    signalsByType,
    opportunitiesByStatus,
    topCategories,
    recentOpportunities,
    sourceHealth,
    [lastJob],
  ] = await Promise.all([
    db.select({ n: count() }).from(entities),
    db.select({ n: count() }).from(opportunities),
    db.select({ n: count() }).from(opportunities).where(eq(opportunities.status, 'open')),
    db.select({ n: count() }).from(contacts),
    db.select({ n: count() }).from(signals),
    db.select({ n: count() }).from(sellerProfiles),
    db.select({ entityType: entities.entityType, n: count() }).from(entities).groupBy(entities.entityType),
    db.select({ signalType: signals.signalType, n: count() }).from(signals).groupBy(signals.signalType),
    db.select({ status: opportunities.status, n: count() }).from(opportunities).groupBy(opportunities.status),
    listCategories(db),
    listOpportunities(db, { limit: 8 }),
    getSourceHealth(db),
    db
      .select()
      .from(refreshJobs)
      .where(isNotNull(refreshJobs.finishedAt))
      .orderBy(desc(refreshJobs.finishedAt))
      .limit(1),
  ]);

  return {
    counts: {
      entities: num(entityCount?.n),
      opportunities: num(oppCount?.n),
      openOpportunities: num(openOppCount?.n),
      contacts: num(contactCount?.n),
      signals: num(signalCount?.n),
      sellerProfiles: num(sellerCount?.n),
    },
    entitiesByType: entitiesByType.map((r) => ({ entityType: r.entityType, count: num(r.n) })),
    signalsByType: signalsByType.map((r) => ({ signalType: r.signalType, count: num(r.n) })),
    opportunitiesByStatus: opportunitiesByStatus.map((r) => ({ status: r.status, count: num(r.n) })),
    topCategories: topCategories.filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 8),
    recentOpportunities,
    sourceHealth,
    lastRefresh: lastJob?.finishedAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Budget intel
// ---------------------------------------------------------------------------

export async function getBudgetIntel(db: AppDatabase): Promise<BudgetIntelDTO> {
  const rows = await db
    .select({ line: budgetLines, entityName: entities.name, entityType: entities.entityType })
    .from(budgetLines)
    .leftJoin(entities, eq(budgetLines.entityId, entities.id))
    .orderBy(desc(budgetLines.amount));

  const lines: BudgetLineView[] = rows.map((r) => ({
    ...r.line,
    entityName: r.entityName,
    entityType: r.entityType,
  }));

  const catTotals = new Map<string, { total: number; count: number }>();
  let totalBudget = 0;
  const byEntityMap = new Map<
    string,
    { entityId: string; entityName: string; entityType: string; total: number; trendDelta: number | null; cats: Set<string> }
  >();

  for (const l of lines) {
    const amt = l.amount ?? 0;
    totalBudget += amt;
    for (const k of l.categoryKeys) {
      const c = catTotals.get(k) ?? { total: 0, count: 0 };
      c.total += amt;
      c.count += 1;
      catTotals.set(k, c);
    }
    if (l.entityId) {
      const e =
        byEntityMap.get(l.entityId) ??
        {
          entityId: l.entityId,
          entityName: l.entityName ?? 'Unknown',
          entityType: l.entityType ?? 'state_agency',
          total: 0,
          trendDelta: null as number | null,
          cats: new Set<string>(),
        };
      e.total += amt;
      if (l.trendDelta != null && (e.trendDelta == null || l.trendDelta > e.trendDelta)) e.trendDelta = l.trendDelta;
      for (const k of l.categoryKeys) e.cats.add(k);
      byEntityMap.set(l.entityId, e);
    }
  }

  return {
    totalBudget,
    lines,
    totalsByCategory: [...catTotals.entries()]
      .map(([key, v]) => ({ key, label: categoryLabel(key), total: v.total, count: v.count }))
      .sort((a, b) => b.total - a.total),
    byEntity: [...byEntityMap.values()]
      .map((e) => ({
        entityId: e.entityId,
        entityName: e.entityName,
        entityType: e.entityType as BudgetIntelDTO['byEntity'][number]['entityType'],
        total: e.total,
        trendDelta: e.trendDelta,
        categoryKeys: [...e.cats],
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

interface RawMatch {
  id: string | null;
  targetType: 'opportunity' | 'entity';
  targetId: string;
  entityId: string | null;
  score: number;
  tier: 'high' | 'medium' | 'low';
  reasons: MatchView['reasons'];
}

export async function decorateMatches(
  db: AppDatabase,
  raw: RawMatch[],
  sellerProfileId: string | null,
): Promise<MatchResults> {
  const oppIds = raw.filter((m) => m.targetType === 'opportunity').map((m) => m.targetId);
  const entIds = raw.filter((m) => m.targetType === 'entity').map((m) => m.targetId);

  const oppItems = oppIds.length
    ? await db
        .select(OPP_SELECT)
        .from(opportunities)
        .leftJoin(entities, eq(opportunities.entityId, entities.id))
        .where(inArray(opportunities.id, oppIds))
    : [];
  const entItems = entIds.length ? await db.select().from(entities).where(inArray(entities.id, entIds)) : [];
  const oppMap = new Map((oppItems as OpportunityListItem[]).map((o) => [o.id, o]));
  const entMap = new Map(entItems.map((e) => [e.id, e]));

  const allEvidence = await resolveEvidence(db, raw.map((m) => m.targetId));
  const evByTarget = new Map<string, EvidenceRef[]>();
  // evidence rows don't carry targetId in EvidenceRef; re-query mapping cheaply:
  const links = raw.length
    ? await db
        .select({ id: evidenceSpans.id, targetId: evidenceSpans.targetId })
        .from(evidenceSpans)
        .where(inArray(evidenceSpans.targetId, raw.map((m) => m.targetId)))
    : [];
  const evById = new Map(allEvidence.map((e) => [e.id, e]));
  for (const l of links) {
    if (!l.targetId) continue;
    const ref = evById.get(l.id);
    if (!ref) continue;
    const arr = evByTarget.get(l.targetId) ?? [];
    arr.push(ref);
    evByTarget.set(l.targetId, arr);
  }

  const toView = (m: RawMatch): MatchView => ({
    id: m.id,
    targetType: m.targetType,
    targetId: m.targetId,
    entityId: m.entityId,
    score: m.score,
    tier: m.tier,
    reasons: m.reasons,
    opportunity: m.targetType === 'opportunity' ? oppMap.get(m.targetId) ?? null : null,
    entity: m.targetType === 'entity' ? entMap.get(m.targetId) ?? null : null,
    evidence: (evByTarget.get(m.targetId) ?? []).slice(0, 8),
  });

  return {
    sellerProfileId,
    opportunityMatches: raw.filter((m) => m.targetType === 'opportunity').map(toView),
    entityMatches: raw.filter((m) => m.targetType === 'entity').map(toView),
  };
}

export { categoryLabel };
