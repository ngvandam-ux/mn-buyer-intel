/**
 * Controlled vocabularies shared across the whole system.
 *
 * These are intentionally jurisdiction-agnostic. Adding another state means adding
 * connectors that emit these same types — never editing the taxonomy.
 */

// ---------------------------------------------------------------------------
// Entity taxonomy — what kind of public buyer an organization is.
// ---------------------------------------------------------------------------

export const ENTITY_TYPES = [
  'state_agency',
  'city',
  'county',
  'police_public_safety',
  'higher_education',
  'military_national_guard',
  'cooperative_purchasing',
  'special_district_transit_council',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  state_agency: 'State Agency',
  city: 'City',
  county: 'County',
  police_public_safety: 'Police / Public Safety',
  higher_education: 'Higher Education',
  military_national_guard: 'Military / National Guard',
  cooperative_purchasing: 'Cooperative Purchasing',
  special_district_transit_council: 'Special District / Transit / Council',
};

// ---------------------------------------------------------------------------
// Signal taxonomy — types of buying signal we extract.
// ---------------------------------------------------------------------------

export const SIGNAL_TYPES = [
  'open_solicitation',
  'upcoming_event',
  'expiring_contract',
  'award_history',
  'budget_priority',
  'policy_priority',
  'strategic_initiative',
  'contact_exposure',
  'cooperative_pathway',
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  open_solicitation: 'Open solicitation',
  upcoming_event: 'Upcoming event / pre-bid / meeting',
  expiring_contract: 'Expiring contract',
  award_history: 'Award result / historical buy',
  budget_priority: 'Published budget priority',
  policy_priority: 'Procurement policy priority',
  strategic_initiative: 'Strategic initiative / article / newsletter',
  contact_exposure: 'Contact exposure',
  cooperative_pathway: 'Cooperative contract pathway',
};

/**
 * Baseline strength each signal type contributes to a match, 0..1.
 * Open solicitations are the strongest demand signal; articles the weakest.
 */
export const SIGNAL_TYPE_STRENGTH: Record<SignalType, number> = {
  open_solicitation: 1.0,
  upcoming_event: 0.8,
  expiring_contract: 0.7,
  award_history: 0.6,
  cooperative_pathway: 0.5,
  budget_priority: 0.45,
  policy_priority: 0.4,
  contact_exposure: 0.35,
  strategic_initiative: 0.25,
};

// ---------------------------------------------------------------------------
// Opportunity status.
// ---------------------------------------------------------------------------

export const OPPORTUNITY_STATUSES = ['open', 'upcoming', 'awarded', 'closed', 'unknown'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

// ---------------------------------------------------------------------------
// Refresh-job status.
// ---------------------------------------------------------------------------

export const REFRESH_JOB_STATUSES = ['pending', 'running', 'success', 'partial', 'error'] as const;
export type RefreshJobStatus = (typeof REFRESH_JOB_STATUSES)[number];

// ---------------------------------------------------------------------------
// Scoring factors — the dimensions a match score is decomposed into.
// ---------------------------------------------------------------------------

export const SCORE_FACTORS = [
  'category',
  'opportunity_text',
  'office_name',
  'priority_language',
  'contact_presence',
  'geography',
  'signal_type',
] as const;

export type ScoreFactorKey = (typeof SCORE_FACTORS)[number];

export type MatchTier = 'high' | 'medium' | 'low';

export type ExtractionKind = 'entity' | 'office' | 'contact' | 'opportunity' | 'signal';

// ---------------------------------------------------------------------------
// Type guards / helpers.
// ---------------------------------------------------------------------------

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function isSignalType(value: string): value is SignalType {
  return (SIGNAL_TYPES as readonly string[]).includes(value);
}
