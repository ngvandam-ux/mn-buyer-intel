/**
 * Matching engine — loads the buyer universe from the DB, scores it against a seller with
 * the pure {@link scoreOpportunity} function, and persists explainable matches.
 *
 *   computeMatches  — read DB, score, return match objects (no writes)
 *   previewMatches  — computeMatches for an ad-hoc (unsaved) seller profile
 *   runMatching     — load a saved profile, compute, and persist into `matches`
 */

import type { MatchReason, MatchTier, MatchTargetType, OpportunityStatus, SignalType } from '@mn/core';
import { DEFAULT_FOCUS, categoryLabel, detectCategories, lensWeightForCategories } from '@mn/core';
import {
  type AppDatabase,
  budgetLines,
  contacts,
  entities,
  eq,
  evidenceSpans,
  matches,
  opportunities,
  sellerProfiles,
  signals,
} from '@mn/db';
import {
  type OpportunityScoringInput,
  type ScoredEntity,
  type ScoredSignal,
  type SellerInput,
  buildSellerVector,
  scoreOpportunity,
} from './score.js';

export interface MatchResult {
  targetType: MatchTargetType;
  targetId: string;
  entityId: string | null;
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
}

export interface ComputedMatches {
  opportunityMatches: MatchResult[];
  entityMatches: MatchResult[];
}

const TIER_RANK: Record<MatchTier, number> = { high: 3, medium: 2, low: 1 };

/** Load the buyer universe, score against the seller, return matches (no DB writes). */
export async function computeMatches(
  db: AppDatabase,
  seller: SellerInput,
  lens: string = DEFAULT_FOCUS,
): Promise<ComputedMatches> {
  const vector = buildSellerVector(seller);
  // Focus lens re-ranks by category — boosts tech/products, demotes construction/services.
  const lensAdjust = (rawScore: number, categoryKeys: string[]): number =>
    Math.min(100, Math.max(0, Math.round(rawScore * lensWeightForCategories(lens, categoryKeys))));

  const [oppRows, entRows, sigRows, contactRows, evRows, budgetRows] = await Promise.all([
    db.select().from(opportunities),
    db.select().from(entities),
    db.select().from(signals),
    db.select().from(contacts),
    db
      .select({ targetId: evidenceSpans.targetId, targetTable: evidenceSpans.targetTable, id: evidenceSpans.id })
      .from(evidenceSpans),
    db.select().from(budgetLines),
  ]);

  const entityById = new Map(entRows.map((e) => [e.id, e]));
  const entitiesWithContact = new Set(contactRows.map((c) => c.entityId).filter(Boolean) as string[]);

  // Decision-maker map: contacts per entity → the best person to call for the seller.
  const contactsByEntity = new Map<string, typeof contactRows>();
  for (const c of contactRows) {
    if (!c.entityId) continue;
    push(contactsByEntity, c.entityId, c);
  }
  const bestContactFor = (entityId: string | null) => {
    if (!entityId) return null;
    const cs = contactsByEntity.get(entityId);
    if (!cs || cs.length === 0) return null;
    const reachable = cs.filter((c) => c.email);
    const pool = reachable.length ? reachable : cs;
    const byRank = (a: (typeof cs)[number], b: (typeof cs)[number]) => (b.titleRank ?? 0) - (a.titleRank ?? 0);
    const specialized = pool
      .filter((c) => c.roleCategory && vector.categories.has(c.roleCategory))
      .sort(byRank);
    const general = pool.filter((c) => !c.roleCategory).sort(byRank);
    const pick = specialized[0] ?? general[0] ?? [...pool].sort(byRank)[0];
    return pick ? { name: pick.name, title: pick.title, roleCategory: pick.roleCategory } : null;
  };

  // Per-entity budget summary for budget→category fit.
  interface BudgetSummary {
    categories: Set<string>;
    totalAmount: number;
    maxTrend: number;
    lineIds: string[];
  }
  const budgetByEntity = new Map<string, BudgetSummary>();
  for (const b of budgetRows) {
    if (!b.entityId) continue;
    const s = budgetByEntity.get(b.entityId) ?? { categories: new Set(), totalAmount: 0, maxTrend: 0, lineIds: [] };
    for (const c of b.categoryKeys) s.categories.add(c);
    s.totalAmount += b.amount ?? 0;
    if ((b.trendDelta ?? 0) > s.maxTrend) s.maxTrend = b.trendDelta ?? 0;
    s.lineIds.push(b.id);
    budgetByEntity.set(b.entityId, s);
  }

  const budgetFitFor = (entityId: string | null) => {
    if (!entityId) return null;
    const s = budgetByEntity.get(entityId);
    if (!s) return null;
    const overlap = [...vector.categories].filter((c) => s.categories.has(c));
    if (overlap.length === 0) return null;
    const trend = Math.max(0, s.maxTrend);
    const score = Math.min(1, 0.6 + Math.min(0.4, trend));
    const money = s.totalAmount ? `$${Math.round(s.totalAmount / 1_000_000)}M` : 'funded';
    const trendStr = s.maxTrend ? ` (${s.maxTrend > 0 ? '+' : ''}${Math.round(s.maxTrend * 100)}%)` : '';
    return {
      score,
      reason: `Funded ${overlap.map(categoryLabel).join(', ')} budget: ${money}${trendStr}`,
      evidenceSpanIds: s.lineIds.flatMap((id) => evidenceByTarget.get(id) ?? []),
    };
  };

  const signalsByOpp = new Map<string, ScoredSignal[]>();
  const signalsByEntity = new Map<string, ScoredSignal[]>();
  for (const s of sigRows) {
    const scored: ScoredSignal = {
      signalType: s.signalType as SignalType,
      strength: s.strength,
      title: s.title,
      detail: s.detail,
    };
    if (s.opportunityId) push(signalsByOpp, s.opportunityId, scored);
    if (s.entityId) push(signalsByEntity, s.entityId, scored);
  }

  const evidenceByTarget = new Map<string, string[]>();
  for (const e of evRows) {
    if (e.targetId) push(evidenceByTarget, e.targetId, e.id);
  }

  const toScoredEntity = (id: string | null): ScoredEntity | null => {
    if (!id) return null;
    const e = entityById.get(id);
    return e ? { id: e.id, name: e.name, entityType: e.entityType, county: e.county, city: e.city } : null;
  };

  // ---- opportunity matches ----
  const opportunityMatches: MatchResult[] = [];
  for (const opp of oppRows) {
    const entity = toScoredEntity(opp.entityId);
    const oppSignals = [
      ...(signalsByOpp.get(opp.id) ?? []),
      ...(opp.entityId ? signalsByEntity.get(opp.entityId) ?? [] : []),
    ];
    const evidenceSpanIds = [
      ...(evidenceByTarget.get(opp.id) ?? []),
      ...(opp.entityId ? evidenceByTarget.get(opp.entityId) ?? [] : []),
    ];
    const input: OpportunityScoringInput = {
      opportunity: {
        id: opp.id,
        title: opp.title,
        description: opp.description,
        status: opp.status as OpportunityStatus,
        businessUnit: opp.businessUnit,
        solicitationType: opp.solicitationType,
        categoryKeys: opp.categoryKeys,
      },
      entity,
      signals: oppSignals,
      hasNamedContact: opp.entityId ? entitiesWithContact.has(opp.entityId) : false,
      evidenceSpanIds,
      budgetFit: budgetFitFor(opp.entityId),
      decisionMaker: bestContactFor(opp.entityId),
    };
    const outcome = scoreOpportunity(vector, input);
    if (outcome.relevant) {
      opportunityMatches.push({
        targetType: 'opportunity',
        targetId: opp.id,
        entityId: opp.entityId,
        score: lensAdjust(outcome.score, opp.categoryKeys),
        tier: outcome.tier,
        reasons: outcome.reasons,
      });
    }
  }

  // ---- entity matches: rollup of opp matches, plus entity-level signal matches ----
  const entityBest = new Map<string, MatchResult>();
  const consider = (m: MatchResult) => {
    const cur = entityBest.get(m.targetId);
    if (!cur || m.score > cur.score || (m.score === cur.score && TIER_RANK[m.tier] > TIER_RANK[cur.tier])) {
      entityBest.set(m.targetId, m);
    }
  };

  for (const om of opportunityMatches) {
    if (!om.entityId) continue;
    consider({ targetType: 'entity', targetId: om.entityId, entityId: om.entityId, score: om.score, tier: om.tier, reasons: om.reasons });
  }

  // entity-level signals → synthetic "general buying interest" opportunity per entity
  for (const ent of entRows) {
    const entSignals = signalsByEntity.get(ent.id) ?? [];
    if (entSignals.length === 0) continue;
    const signalText = entSignals.map((s) => `${s.title} ${s.detail ?? ''}`).join(' ');
    const input: OpportunityScoringInput = {
      opportunity: {
        id: ent.id,
        title: ent.name,
        description: signalText,
        status: 'unknown',
        businessUnit: ent.name,
        solicitationType: null,
        categoryKeys: detectCategories(signalText),
      },
      entity: { id: ent.id, name: ent.name, entityType: ent.entityType, county: ent.county, city: ent.city },
      signals: entSignals,
      hasNamedContact: entitiesWithContact.has(ent.id),
      evidenceSpanIds: evidenceByTarget.get(ent.id) ?? [],
      budgetFit: budgetFitFor(ent.id),
      decisionMaker: bestContactFor(ent.id),
    };
    const outcome = scoreOpportunity(vector, input);
    if (outcome.relevant) {
      consider({
        targetType: 'entity',
        targetId: ent.id,
        entityId: ent.id,
        score: lensAdjust(outcome.score, input.opportunity.categoryKeys),
        tier: outcome.tier,
        reasons: outcome.reasons,
      });
    }
  }

  const entityMatches = [...entityBest.values()].sort((a, b) => b.score - a.score);
  opportunityMatches.sort((a, b) => b.score - a.score);
  return { opportunityMatches, entityMatches };
}

/** Score the DB against an ad-hoc seller profile without saving anything. */
export async function previewMatches(
  db: AppDatabase,
  seller: SellerInput,
  lens: string = DEFAULT_FOCUS,
): Promise<ComputedMatches> {
  return computeMatches(db, seller, lens);
}

/** Compute and persist matches for a saved seller profile. Returns the count written. */
export async function runMatching(
  db: AppDatabase,
  sellerProfileId: string,
  lens: string = DEFAULT_FOCUS,
): Promise<ComputedMatches> {
  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.id, sellerProfileId)).limit(1);
  if (!profile) throw new Error(`seller profile ${sellerProfileId} not found`);

  const seller: SellerInput = {
    companyName: profile.companyName,
    capabilities: profile.capabilities,
    services: profile.services,
    products: profile.products,
    keywords: profile.keywords,
    certifications: profile.certifications,
    categories: profile.categories,
    geographies: profile.geographies,
  };
  const result = await computeMatches(db, seller, lens);

  await db.delete(matches).where(eq(matches.sellerProfileId, sellerProfileId));
  const rows = [...result.opportunityMatches, ...result.entityMatches].map((m) => ({
    sellerProfileId,
    targetType: m.targetType,
    targetId: m.targetId,
    entityId: m.entityId,
    score: m.score,
    tier: m.tier,
    reasons: m.reasons,
  }));
  if (rows.length > 0) {
    // chunk to keep parameter counts sane on large universes
    for (let i = 0; i < rows.length; i += 200) {
      await db.insert(matches).values(rows.slice(i, i + 200));
    }
  }
  return result;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
