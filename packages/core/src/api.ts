/**
 * API DTOs — the shapes the HTTP layer returns and the web app consumes. Defined here so
 * both `@mn/api` and `@mn/web` share one contract (full-stack type safety) without the web
 * app depending on the database package.
 */

import type {
  BudgetLine,
  Category,
  Contact,
  Entity,
  MatchReason,
  MatchTargetType,
  Office,
  Opportunity,
  RefreshJob,
  SellerProfile,
  Signal,
} from './domain.js';
import type { EntityType, MatchTier, OpportunityStatus, SignalType } from './taxonomy.js';

/** One resolved evidence pointer: a snippet + its source document. */
export interface EvidenceRef {
  id: string;
  field: string;
  locator: string;
  rawSnippet: string;
  extractedAt: string;
  sourceDocumentId: string;
  sourceUrl: string;
  sourceConnectorId: string;
  fetchedAt: string;
}

export interface SourceHealth {
  id: string;
  sourceName: string;
  url: string;
  jurisdiction: string;
  entityHint: EntityType;
  fetchMode: 'static' | 'browser';
  live: boolean;
  description: string | null;
  lastJob: RefreshJob | null;
}

export interface OpportunityListItem {
  id: string;
  title: string;
  status: OpportunityStatus;
  postedDate: string | null;
  dueDate: string | null;
  url: string | null;
  solicitationType: string | null;
  businessUnit: string | null;
  categoryKeys: string[];
  confidence: number;
  entityId: string | null;
  entityName: string | null;
  entityType: EntityType | null;
}

export interface EntityListItem extends Entity {
  opportunityCount: number;
  signalCount: number;
  contactCount: number;
}

export interface ContactListItem extends Contact {
  entityName: string | null;
  officeName: string | null;
}

export interface SignalListItem extends Signal {
  entityName: string | null;
  opportunityTitle: string | null;
}

export interface EntityDetail {
  entity: Entity;
  offices: Office[];
  contacts: Contact[];
  opportunities: OpportunityListItem[];
  signals: Signal[];
  budgetLines: BudgetLine[];
  evidence: EvidenceRef[];
}

export interface BudgetLineView extends BudgetLine {
  entityName: string | null;
  entityType: EntityType | null;
}

export interface BudgetIntelDTO {
  totalBudget: number;
  lines: BudgetLineView[];
  totalsByCategory: Array<{ key: string; label: string; total: number; count: number }>;
  byEntity: Array<{
    entityId: string;
    entityName: string;
    entityType: EntityType;
    total: number;
    trendDelta: number | null;
    categoryKeys: string[];
  }>;
}

export interface OpportunityDetail {
  opportunity: Opportunity;
  entity: Entity | null;
  office: Office | null;
  signals: Signal[];
  categories: Category[];
  evidence: EvidenceRef[];
}

/** A match with its resolved target and supporting evidence — the explainable result. */
export interface MatchView {
  id: string | null;
  targetType: MatchTargetType;
  targetId: string;
  entityId: string | null;
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
  opportunity: OpportunityListItem | null;
  entity: Entity | null;
  evidence: EvidenceRef[];
}

export interface MatchResults {
  sellerProfileId: string | null;
  opportunityMatches: MatchView[];
  entityMatches: MatchView[];
}

export interface DashboardDTO {
  counts: {
    entities: number;
    opportunities: number;
    openOpportunities: number;
    contacts: number;
    signals: number;
    sellerProfiles: number;
  };
  entitiesByType: Array<{ entityType: EntityType; count: number }>;
  signalsByType: Array<{ signalType: SignalType; count: number }>;
  opportunitiesByStatus: Array<{ status: OpportunityStatus; count: number }>;
  topCategories: Array<{ key: string; label: string; count: number }>;
  recentOpportunities: OpportunityListItem[];
  sourceHealth: SourceHealth[];
  lastRefresh: string | null;
}

export type { BudgetLine, Category, Contact, Entity, Office, Opportunity, RefreshJob, SellerProfile, Signal };
