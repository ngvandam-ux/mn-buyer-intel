/**
 * The deterministic, explainable match scorer. Pure functions only — no DB, no time, no
 * randomness — so the same inputs always produce the same score, tier, and reasons. This
 * is the file the match-scoring unit tests exercise.
 *
 * The numeric score (0..100) is a weighted sum of factor contributions. The tier is
 * decided by explicit rules over which conditions hold, per the product spec:
 *   high   = open solicitation + named contact + matching category
 *   medium = (expiring contract | award history | open) + matching entity/office/category
 *   low    = topical relevance from a priority/strategic/budget signal only
 */

import type {
  EntityType,
  MatchReason,
  MatchTier,
  OpportunityStatus,
  ScoreWeights,
  SignalType,
} from '@mn/core';
import {
  DEFAULT_SCORE_WEIGHTS,
  SIGNAL_TYPE_LABELS,
  categoryLabel,
  clamp,
  detectCategories,
  overlapCount,
  tokenize,
  tokenizeAll,
} from '@mn/core';

export interface SellerInput {
  companyName: string;
  capabilities?: string[];
  services?: string[];
  products?: string[];
  keywords?: string[];
  certifications?: string[];
  categories?: string[];
  geographies?: string[];
}

export interface SellerVector {
  companyName: string;
  tokens: Set<string>;
  categories: Set<string>;
  certifications: string[];
  geographies: Set<string>;
}

export interface ScoredSignal {
  signalType: SignalType;
  strength: number;
  title: string;
  detail: string | null;
}

export interface ScoredEntity {
  id: string;
  name: string;
  entityType: EntityType;
  county: string | null;
  city: string | null;
}

export interface OpportunityScoringInput {
  opportunity: {
    id: string;
    title: string;
    description: string | null;
    status: OpportunityStatus;
    businessUnit: string | null;
    solicitationType: string | null;
    categoryKeys: string[];
  };
  entity: ScoredEntity | null;
  /** Signals attached to this opportunity and/or its entity. */
  signals: ScoredSignal[];
  hasNamedContact: boolean;
  /** Evidence span ids backing this opportunity, attached to opportunity-derived reasons. */
  evidenceSpanIds: string[];
  /** Precomputed budget→category fit for this opportunity's buyer (0..1) + a reason. */
  budgetFit?: { score: number; reason: string; evidenceSpanIds?: string[] } | null;
}

export interface ScoreOutcome {
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
  relevant: boolean;
}

const PRIORITY_SIGNALS = new Set<SignalType>([
  'budget_priority',
  'policy_priority',
  'strategic_initiative',
]);

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildSellerVector(seller: SellerInput): SellerVector {
  const tokens = tokenizeAll([
    ...(seller.capabilities ?? []),
    ...(seller.services ?? []),
    ...(seller.products ?? []),
    ...(seller.keywords ?? []),
  ]);
  const explicitCats = seller.categories ?? [];
  const detected = detectCategories(
    [...(seller.capabilities ?? []), ...(seller.services ?? []), ...(seller.products ?? []), ...(seller.keywords ?? [])].join(' '),
  );
  return {
    companyName: seller.companyName,
    tokens,
    categories: new Set([...explicitCats, ...detected]),
    certifications: seller.certifications ?? [],
    geographies: new Set((seller.geographies ?? []).map((g) => g.trim().toLowerCase())),
  };
}

export function scoreOpportunity(
  seller: SellerVector,
  input: OpportunityScoringInput,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
): ScoreOutcome {
  const { opportunity: opp, entity, signals, hasNamedContact, evidenceSpanIds, budgetFit } = input;
  const reasons: MatchReason[] = [];

  // --- category ---
  const oppCats = new Set(opp.categoryKeys);
  const matchedCats = [...seller.categories].filter((c) => oppCats.has(c));
  const categoryMatch = matchedCats.length > 0;
  if (categoryMatch) {
    // Score by how well the seller's relevant categories cover, not how broadly the
    // opportunity was tagged — a perfect single-category hit earns full credit.
    const ratio = matchedCats.length / Math.max(1, Math.min(seller.categories.size, oppCats.size));
    const contribution = round1(weights.category * Math.min(1, ratio));
    reasons.push({
      factor: 'category',
      contribution,
      reason: `Matches your category: ${matchedCats.map(categoryLabel).join(', ')}`,
      evidenceSpanIds,
    });
  }

  // --- opportunity text ---
  const oppTokens = tokenizeAll([opp.title, opp.description, opp.businessUnit, opp.solicitationType]);
  const shared = [...seller.tokens].filter((t) => oppTokens.has(t));
  const textMatch = shared.length >= 2;
  // Award text points only at the same threshold that counts toward relevance/tier.
  if (textMatch) {
    const contribution = round1(weights.opportunity_text * Math.min(1, shared.length / 3));
    reasons.push({
      factor: 'opportunity_text',
      contribution,
      reason: `Solicitation text overlaps your offering: ${shared.slice(0, 5).join(', ')}`,
      evidenceSpanIds,
    });
  }

  // --- signal strength ---
  const strongest = signals.reduce<ScoredSignal | null>(
    (best, s) => (best === null || s.strength > best.strength ? s : best),
    null,
  );
  // The opportunity's own status is authoritative: an entity-rolled-up open_solicitation
  // signal must NOT make an awarded/closed opportunity look open.
  const hasOpen =
    opp.status === 'open' ||
    (opp.status !== 'awarded' &&
      opp.status !== 'closed' &&
      signals.some((s) => s.signalType === 'open_solicitation'));
  const hasExpiring = signals.some((s) => s.signalType === 'expiring_contract');
  const hasHistory = signals.some((s) => s.signalType === 'award_history');
  if (strongest && strongest.strength > 0) {
    const contribution = round1(weights.signal_type * clamp(strongest.strength, 0, 1));
    reasons.push({
      factor: 'signal_type',
      contribution,
      reason: `Active buying signal: ${SIGNAL_TYPE_LABELS[strongest.signalType]}`,
      evidenceSpanIds,
    });
  }

  // --- entity / office name ---
  const entityTokens = tokenize(entity?.name);
  const sharedEntity = [...seller.tokens].filter((t) => entityTokens.has(t));
  const entityNameMatch = sharedEntity.length > 0;
  if (entityNameMatch && entity) {
    const contribution = round1(weights.office_name * Math.min(1, sharedEntity.length / 1));
    reasons.push({
      factor: 'office_name',
      contribution,
      reason: `Buyer focus aligns with "${entity.name}"`,
      evidenceSpanIds,
    });
  }

  // --- priority language ---
  const priorityHit = signals.find((s) => {
    if (!PRIORITY_SIGNALS.has(s.signalType)) return false;
    const pTokens = tokenizeAll([s.title, s.detail]);
    const overlap = overlapCount(seller.tokens, pTokens);
    const catText = [...seller.categories].some((c) => `${s.title} ${s.detail ?? ''}`.toLowerCase().includes(c));
    return overlap > 0 || catText;
  });
  const priorityMatch = Boolean(priorityHit);
  if (priorityHit) {
    reasons.push({
      factor: 'priority_language',
      contribution: round1(weights.priority_language),
      reason: `Aligns with a published priority: ${priorityHit.title}`,
      evidenceSpanIds,
    });
  }

  // --- budget fit (funded, trending demand in the seller's categories) ---
  const budgetMatch = Boolean(budgetFit && budgetFit.score > 0);
  if (budgetFit && budgetFit.score > 0) {
    reasons.push({
      factor: 'budget_fit',
      contribution: round1(weights.budget_fit * clamp(budgetFit.score, 0, 1)),
      reason: budgetFit.reason,
      evidenceSpanIds: budgetFit.evidenceSpanIds ?? [],
    });
  }

  // --- contact presence ---
  if (hasNamedContact) {
    reasons.push({
      factor: 'contact_presence',
      contribution: round1(weights.contact_presence),
      reason: 'A named procurement contact is available for this buyer',
      evidenceSpanIds: [],
    });
  }

  // --- geography ---
  const geo = sellerGeoMatch(seller, entity);
  if (geo.match) {
    reasons.push({
      factor: 'geography',
      contribution: round1(weights.geography),
      reason: geo.reason,
      evidenceSpanIds: [],
    });
  }

  const score = clamp(Math.round(reasons.reduce((sum, r) => sum + r.contribution, 0)), 0, 100);
  const relevant = categoryMatch || textMatch || priorityMatch || budgetMatch;

  let tier: MatchTier;
  if (hasOpen && hasNamedContact && categoryMatch) tier = 'high';
  else if ((hasExpiring || hasHistory || hasOpen) && (categoryMatch || entityNameMatch || textMatch)) tier = 'medium';
  else tier = 'low';

  return { score, tier, reasons, relevant };
}

function sellerGeoMatch(seller: SellerVector, entity: ScoredEntity | null): { match: boolean; reason: string } {
  if (seller.geographies.size === 0) return { match: true, reason: 'Statewide coverage (no geography restriction)' };
  if (seller.geographies.has('statewide') || seller.geographies.has('mn') || seller.geographies.has('minnesota')) {
    return { match: true, reason: 'You serve statewide' };
  }
  if (entity) {
    const county = entity.county?.toLowerCase();
    const city = entity.city?.toLowerCase();
    if (county && seller.geographies.has(county)) return { match: true, reason: `You serve ${entity.county} County` };
    if (city && seller.geographies.has(city)) return { match: true, reason: `You serve ${entity.city}` };
  }
  return { match: false, reason: '' };
}
