/**
 * Normalization: turn a connector's {@link Extraction}s into upserted rows with evidence.
 *
 * Idempotent. Entities/offices/contacts/opportunities are resolved by natural keys so
 * re-running a refresh updates in place rather than duplicating. Evidence for a source
 * document is cleared and rewritten on each pass, keeping the audit trail current.
 */

import type { EntityType, Extraction, OpportunityStatus, SignalType } from '@mn/core';
import { SIGNAL_TYPE_STRENGTH, detectCategories } from '@mn/core';
import type {
  ContactFields,
  EntityFields,
  OfficeFields,
  OpportunityFields,
  SignalFields,
} from '@mn/connectors';
import {
  type AppDatabase,
  and,
  categories,
  contacts,
  entities,
  eq,
  evidenceSpans,
  offices,
  opportunities,
  opportunityCategories,
  signals,
  sql,
} from '@mn/db';
import { CATEGORY_TAXONOMY } from '@mn/core';

export interface NormalizeContext {
  db: AppDatabase;
  sourceDocumentId: string;
  /** extractedAt for all rows from this document (the capture time). */
  at: string;
  entityCache: Map<string, string>;
  officeCache: Map<string, string>;
  categoryCache: Map<string, string>;
  counts: { upserted: number };
}

const lc = (s: string) => s.trim().toLowerCase();

/** Ensure all taxonomy categories exist; fill the cache with key→id. */
export async function ensureCategories(db: AppDatabase, cache: Map<string, string>): Promise<void> {
  const existing = await db.select().from(categories);
  for (const row of existing) cache.set(row.key, row.id);
  for (const cat of CATEGORY_TAXONOMY) {
    if (cache.has(cat.key)) continue;
    const [row] = await db
      .insert(categories)
      .values({ key: cat.key, label: cat.label })
      .returning();
    if (row) cache.set(row.key, row.id);
  }
}

async function addEvidence(
  ctx: NormalizeContext,
  ex: Extraction,
  targetTable: string,
  targetId: string,
): Promise<void> {
  if (ex.evidence.length === 0) return;
  await ctx.db.insert(evidenceSpans).values(
    ex.evidence.map((span) => ({
      sourceDocumentId: ctx.sourceDocumentId,
      targetTable,
      targetId,
      field: ex.kind,
      locator: span.locator,
      rawSnippet: span.rawSnippet,
      extractedAt: span.extractedAt || ctx.at,
    })),
  );
}

export async function resolveEntity(
  ctx: NormalizeContext,
  name: string,
  entityType: EntityType,
  extras: Partial<EntityFields> = {},
): Promise<string> {
  const key = lc(name);
  const cached = ctx.entityCache.get(key);
  if (cached) return cached;
  const jurisdiction = extras.jurisdiction ?? 'MN';
  const found = await ctx.db
    .select({ id: entities.id })
    .from(entities)
    .where(and(sql`lower(${entities.name}) = ${key}`, eq(entities.jurisdiction, jurisdiction)))
    .limit(1);
  if (found[0]) {
    ctx.entityCache.set(key, found[0].id);
    return found[0].id;
  }
  const [row] = await ctx.db
    .insert(entities)
    .values({
      name,
      entityType,
      jurisdiction,
      county: extras.county ?? null,
      city: extras.city ?? null,
      website: extras.website ?? null,
      sourceDocumentId: ctx.sourceDocumentId,
      extractedAt: ctx.at,
      confidence: 1,
    })
    .returning();
  ctx.counts.upserted += 1;
  ctx.entityCache.set(key, row!.id);
  return row!.id;
}

export async function processEntity(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  const f = ex.fields as unknown as EntityFields;
  const id = await resolveEntity(ctx, f.name, f.entityType ?? 'state_agency', f);
  await addEvidence(ctx, ex, 'entities', id);
}

export async function resolveOffice(
  ctx: NormalizeContext,
  name: string,
  entityId: string,
  url?: string | null,
): Promise<string> {
  const key = `${entityId}|${lc(name)}`;
  const cached = ctx.officeCache.get(key);
  if (cached) return cached;
  const found = await ctx.db
    .select({ id: offices.id })
    .from(offices)
    .where(and(eq(offices.entityId, entityId), sql`lower(${offices.name}) = ${lc(name)}`))
    .limit(1);
  if (found[0]) {
    ctx.officeCache.set(key, found[0].id);
    return found[0].id;
  }
  const [row] = await ctx.db
    .insert(offices)
    .values({
      entityId,
      name,
      url: url ?? null,
      sourceDocumentId: ctx.sourceDocumentId,
      extractedAt: ctx.at,
      confidence: 1,
    })
    .returning();
  ctx.counts.upserted += 1;
  ctx.officeCache.set(key, row!.id);
  return row!.id;
}

export async function processOffice(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  const f = ex.fields as unknown as OfficeFields;
  const entityId = await resolveEntity(ctx, f.entityName, f.entityType ?? 'state_agency');
  const id = await resolveOffice(ctx, f.name, entityId, f.url);
  await addEvidence(ctx, ex, 'offices', id);
}

export async function processContact(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  const f = ex.fields as unknown as ContactFields;
  const entityId = f.entityName
    ? await resolveEntity(ctx, f.entityName, f.entityType ?? 'state_agency')
    : null;
  const officeId =
    f.officeName && entityId ? await resolveOffice(ctx, f.officeName, entityId) : null;

  // Resolve by email (preferred) else by entityId+name.
  const conds = [];
  if (f.email) conds.push(sql`lower(${contacts.email}) = ${lc(f.email)}`);
  else conds.push(sql`lower(${contacts.name}) = ${lc(f.name)}`);
  if (entityId) conds.push(eq(contacts.entityId, entityId));
  const found = await ctx.db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(...conds))
    .limit(1);

  let id: string;
  if (found[0]) {
    id = found[0].id;
    await ctx.db
      .update(contacts)
      .set({ title: f.title ?? null, phone: f.phone ?? null, officeId })
      .where(eq(contacts.id, id));
  } else {
    const [row] = await ctx.db
      .insert(contacts)
      .values({
        entityId,
        officeId,
        name: f.name,
        title: f.title ?? null,
        email: f.email ?? null,
        phone: f.phone ?? null,
        sourceDocumentId: ctx.sourceDocumentId,
        extractedAt: ctx.at,
        confidence: ex.confidence,
      })
      .returning();
    id = row!.id;
    ctx.counts.upserted += 1;
  }
  await addEvidence(ctx, ex, 'contacts', id);

  // Derived signal: a named, reachable contact is "contact exposure".
  if (f.email && entityId) {
    await upsertSignal(ctx, {
      entityId,
      opportunityId: null,
      signalType: 'contact_exposure',
      title: `Procurement contact: ${f.name}${f.title ? ` (${f.title})` : ''}`,
      detail: f.email,
      url: null,
      observedAt: ctx.at,
      strength: SIGNAL_TYPE_STRENGTH.contact_exposure,
    });
  }
}

export async function processOpportunity(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  const f = ex.fields as unknown as OpportunityFields;
  const entityName = f.entityName ?? f.businessUnit ?? 'State of Minnesota';
  const entityId = await resolveEntity(ctx, entityName, f.entityType ?? 'state_agency');
  const officeId = f.officeName ? await resolveOffice(ctx, f.officeName, entityId) : null;
  const status: OpportunityStatus = f.status ?? 'unknown';

  const categoryKeys = Array.from(
    new Set([...(f.categoryKeys ?? []), ...detectCategories(`${f.title} ${f.description ?? ''}`)]),
  );

  // Resolve by externalId (preferred) else entityId+title.
  const conds = [eq(opportunities.entityId, entityId)];
  if (f.externalId) conds.push(eq(opportunities.externalId, f.externalId));
  else conds.push(sql`lower(${opportunities.title}) = ${lc(f.title)}`);
  const found = await ctx.db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(...conds))
    .limit(1);

  const values = {
    entityId,
    officeId,
    externalId: f.externalId ?? null,
    title: f.title,
    description: f.description ?? null,
    status,
    businessUnit: f.businessUnit ?? null,
    solicitationType: f.solicitationType ?? null,
    postedDate: f.postedDate ?? null,
    dueDate: f.dueDate ?? null,
    url: f.url ?? null,
    lineItems: f.lineItems ?? [],
    categoryKeys,
    sourceDocumentId: ctx.sourceDocumentId,
    extractedAt: ctx.at,
    confidence: ex.confidence,
  };

  let id: string;
  if (found[0]) {
    id = found[0].id;
    await ctx.db.update(opportunities).set(values).where(eq(opportunities.id, id));
  } else {
    const [row] = await ctx.db.insert(opportunities).values(values).returning();
    id = row!.id;
    ctx.counts.upserted += 1;
  }
  await addEvidence(ctx, ex, 'opportunities', id);

  // Link categories (replace set).
  await ctx.db.delete(opportunityCategories).where(eq(opportunityCategories.opportunityId, id));
  for (const key of categoryKeys) {
    const catId = ctx.categoryCache.get(key);
    if (catId) {
      await ctx.db
        .insert(opportunityCategories)
        .values({ opportunityId: id, categoryId: catId })
        .onConflictDoNothing();
    }
  }

  // Derived signal from the opportunity's status.
  const derived = derivedSignalType(status);
  if (derived) {
    await upsertSignal(ctx, {
      entityId,
      opportunityId: id,
      signalType: derived,
      title: `${signalTitlePrefix(derived)}: ${f.title}`,
      detail: f.description ?? f.solicitationType ?? null,
      url: f.url ?? null,
      observedAt: f.postedDate ?? ctx.at,
      strength: SIGNAL_TYPE_STRENGTH[derived],
    });
  }
}

function derivedSignalType(status: OpportunityStatus): SignalType | null {
  if (status === 'open') return 'open_solicitation';
  if (status === 'upcoming') return 'upcoming_event';
  if (status === 'awarded') return 'award_history';
  return null;
}

function signalTitlePrefix(t: SignalType): string {
  if (t === 'open_solicitation') return 'Open solicitation';
  if (t === 'upcoming_event') return 'Upcoming solicitation';
  if (t === 'award_history') return 'Recent award';
  return 'Signal';
}

export async function processSignal(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  const f = ex.fields as unknown as SignalFields;
  const entityId = f.entityName
    ? await resolveEntity(ctx, f.entityName, f.entityType ?? 'state_agency')
    : null;
  const id = await upsertSignal(ctx, {
    entityId,
    opportunityId: null,
    signalType: f.signalType,
    title: f.title,
    detail: f.detail ?? null,
    url: f.url ?? null,
    observedAt: f.observedAt ?? ctx.at,
    strength: f.strength ?? SIGNAL_TYPE_STRENGTH[f.signalType],
  });
  if (id) await addEvidence(ctx, ex, 'signals', id);
}

interface SignalInput {
  entityId: string | null;
  opportunityId: string | null;
  signalType: SignalType;
  title: string;
  detail: string | null;
  url: string | null;
  observedAt: string | null;
  strength: number;
}

/** Insert a signal, deduped by (entity, opportunity, type, title). Returns the row id. */
export async function upsertSignal(ctx: NormalizeContext, s: SignalInput): Promise<string> {
  const conds = [eq(signals.signalType, s.signalType), sql`lower(${signals.title}) = ${lc(s.title)}`];
  conds.push(s.entityId ? eq(signals.entityId, s.entityId) : sql`${signals.entityId} is null`);
  conds.push(
    s.opportunityId ? eq(signals.opportunityId, s.opportunityId) : sql`${signals.opportunityId} is null`,
  );
  const found = await ctx.db
    .select({ id: signals.id })
    .from(signals)
    .where(and(...conds))
    .limit(1);
  if (found[0]) {
    await ctx.db
      .update(signals)
      .set({ detail: s.detail, url: s.url, observedAt: s.observedAt, strength: s.strength })
      .where(eq(signals.id, found[0].id));
    return found[0].id;
  }
  const [row] = await ctx.db
    .insert(signals)
    .values({
      entityId: s.entityId,
      opportunityId: s.opportunityId,
      signalType: s.signalType,
      title: s.title,
      detail: s.detail,
      url: s.url,
      observedAt: s.observedAt,
      strength: s.strength,
      sourceDocumentId: ctx.sourceDocumentId,
      extractedAt: ctx.at,
      confidence: 1,
    })
    .returning();
  ctx.counts.upserted += 1;
  return row!.id;
}
