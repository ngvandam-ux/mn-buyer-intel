/**
 * HTTP routes. Thin wrappers over the query layer + ingest/matching engines.
 */

import type { FastifyInstance } from 'fastify';
import { createFetchContext, getConnector } from '@mn/connectors';
import { type AppDatabase, eq, matches, sellerProfiles, sourceDocuments } from '@mn/db';
import { ingestConnector } from '@mn/ingest';
import { previewMatches, runMatching } from '@mn/matching';
import type { SellerInput } from '@mn/matching';
import {
  decorateMatches,
  getBudgetIntel,
  getDashboard,
  getEntityDetail,
  getOpportunityDetail,
  getReviewQueue,
  getSourceHealth,
  listCategories,
  listContacts,
  listEntities,
  listOpportunities,
  listRefreshJobs,
  listSignals,
  resolveEvidence,
} from './queries.js';

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];

const clampNum = (v: unknown, def: number, min: number, max: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// Connectors with a live refresh currently running — prevents overlapping scrapes.
const refreshing = new Set<string>();

function sellerInputFromBody(body: Record<string, unknown>): SellerInput {
  return {
    companyName: String(body.companyName ?? '').trim(),
    capabilities: asArray(body.capabilities),
    services: asArray(body.services),
    products: asArray(body.products),
    keywords: asArray(body.keywords),
    certifications: asArray(body.certifications),
    categories: asArray(body.categories),
    geographies: asArray(body.geographies),
  };
}

export function registerRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.get('/api/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  app.get('/api/dashboard', async () => getDashboard(db));

  // --- entities ---
  app.get('/api/entities', async (req) => {
    const q = req.query as Record<string, string>;
    return listEntities(db, {
      entityType: q.type,
      q: q.q,
      jurisdiction: q.jurisdiction,
      category: q.category,
    });
  });
  app.get('/api/entities/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await getEntityDetail(db, id);
    if (!detail) return reply.code(404).send({ error: 'entity not found' });
    return detail;
  });

  // --- opportunities ---
  app.get('/api/opportunities', async (req) => {
    const q = req.query as Record<string, string>;
    return listOpportunities(db, {
      status: q.status,
      category: q.category,
      q: q.q,
      source: q.source,
      entityType: q.entityType,
      minConfidence: q.minConfidence !== undefined ? clampNum(q.minConfidence, 0, 0, 1) : undefined,
    });
  });
  app.get('/api/opportunities/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const detail = await getOpportunityDetail(db, id);
    if (!detail) return reply.code(404).send({ error: 'opportunity not found' });
    return detail;
  });

  // --- contacts / signals / categories ---
  app.get('/api/contacts', async (req) => {
    const q = req.query as Record<string, string>;
    return listContacts(db, { q: q.q, entityId: q.entityId });
  });
  app.get('/api/signals', async (req) => {
    const q = req.query as Record<string, string>;
    return listSignals(db, { type: q.type, entityId: q.entityId, q: q.q });
  });
  app.get('/api/categories', async () => listCategories(db));
  app.get('/api/budget', async () => getBudgetIntel(db));

  // --- evidence + source documents (audit) ---
  app.get('/api/evidence/:targetId', async (req) => {
    const { targetId } = req.params as { targetId: string };
    return resolveEvidence(db, [targetId]);
  });
  app.get('/api/source-documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [doc] = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, id)).limit(1);
    if (!doc) return reply.code(404).send({ error: 'source document not found' });
    return doc;
  });

  // --- source health / refresh ---
  app.get('/api/sources', async () => getSourceHealth(db));
  app.get('/api/refresh-jobs', async (req) => {
    const q = req.query as Record<string, string>;
    return listRefreshJobs(db, clampNum(q.limit, 50, 1, 500));
  });
  app.get('/api/review-queue', async (req) => {
    const q = req.query as Record<string, string>;
    return getReviewQueue(db, clampNum(q.threshold, 0.7, 0, 1));
  });
  app.post('/api/refresh/:connectorId', async (req, reply) => {
    const { connectorId } = req.params as { connectorId: string };
    const connector = getConnector(connectorId);
    if (!connector) return reply.code(404).send({ error: `unknown connector ${connectorId}` });
    if (refreshing.has(connectorId)) {
      return reply.code(409).send({ error: 'refresh already in progress for this connector' });
    }
    refreshing.add(connectorId);
    try {
      const ctx = createFetchContext(connector.meta.id);
      return await ingestConnector(db, connector, ctx);
    } finally {
      refreshing.delete(connectorId);
    }
  });

  // --- seller profiles + matching ---
  app.get('/api/seller-profiles', async () => db.select().from(sellerProfiles).orderBy(sellerProfiles.companyName));
  app.get('/api/seller-profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, id)).limit(1);
    if (!profile) return reply.code(404).send({ error: 'seller profile not found' });
    return profile;
  });
  app.post('/api/seller-profiles', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const input = sellerInputFromBody(body);
    if (!input.companyName) return reply.code(400).send({ error: 'companyName is required' });
    const [row] = await db
      .insert(sellerProfiles)
      .values({
        companyName: input.companyName,
        capabilities: input.capabilities ?? [],
        services: input.services ?? [],
        products: input.products ?? [],
        keywords: input.keywords ?? [],
        certifications: input.certifications ?? [],
        categories: input.categories ?? [],
        geographies: input.geographies ?? [],
        notes: typeof body.notes === 'string' ? body.notes : null,
      })
      .returning();
    await runMatching(db, row!.id);
    return reply.code(201).send(row);
  });
  app.put('/api/seller-profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const input = sellerInputFromBody(body);
    if (!input.companyName) return reply.code(400).send({ error: 'companyName is required' });
    const [row] = await db
      .update(sellerProfiles)
      .set({
        companyName: input.companyName,
        capabilities: input.capabilities ?? [],
        services: input.services ?? [],
        products: input.products ?? [],
        keywords: input.keywords ?? [],
        certifications: input.certifications ?? [],
        categories: input.categories ?? [],
        geographies: input.geographies ?? [],
        notes: typeof body.notes === 'string' ? body.notes : null,
      })
      .where(eq(sellerProfiles.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: 'seller profile not found' });
    await runMatching(db, id);
    return row;
  });
  app.delete('/api/seller-profiles/:id', async (req) => {
    const { id } = req.params as { id: string };
    await db.delete(sellerProfiles).where(eq(sellerProfiles.id, id));
    return { ok: true };
  });
  app.get('/api/seller-profiles/:id/matches', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, id)).limit(1);
    if (!profile) return reply.code(404).send({ error: 'seller profile not found' });
    const rows = await db.select().from(matches).where(eq(matches.sellerProfileId, id));
    let raw = rows.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      entityId: r.entityId,
      score: r.score,
      tier: r.tier,
      reasons: r.reasons,
    }));
    if (raw.length === 0) {
      // compute + persist on demand if not yet materialized
      await runMatching(db, id);
      const fresh = await db.select().from(matches).where(eq(matches.sellerProfileId, id));
      raw = fresh.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        entityId: r.entityId,
        score: r.score,
        tier: r.tier,
        reasons: r.reasons,
      }));
    }
    return decorateMatches(db, raw, id);
  });

  // --- ad-hoc match preview (no save) ---
  app.post('/api/match/preview', async (req, reply) => {
    const input = sellerInputFromBody(req.body as Record<string, unknown>);
    if (!input.companyName) input.companyName = 'Preview';
    const computed = await previewMatches(db, input);
    const raw = [...computed.opportunityMatches, ...computed.entityMatches].map((m) => ({
      id: null,
      targetType: m.targetType,
      targetId: m.targetId,
      entityId: m.entityId,
      score: m.score,
      tier: m.tier,
      reasons: m.reasons,
    }));
    return reply.send(await decorateMatches(db, raw, null));
  });
}
