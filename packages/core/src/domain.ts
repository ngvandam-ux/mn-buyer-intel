/**
 * Canonical domain models. These are the single source of truth for the shape of a
 * normalized record. The `@mn/db` schema is written to match them (and asserts
 * assignability in a type test), so the web app can import these without depending on
 * the database driver.
 *
 * All timestamps are ISO-8601 strings. All `confidence` values are 0..1.
 */

import type {
  EntityType,
  MatchTier,
  OpportunityStatus,
  RefreshJobStatus,
  ScoreFactorKey,
  SignalType,
} from './taxonomy.js';

/** Common traceability columns carried by every extracted record. */
export interface Traceable {
  /** The source document this record was extracted from (null for seed/manual rows). */
  sourceDocumentId: string | null;
  /** ISO time the field values were extracted. */
  extractedAt: string;
  /** Extractor confidence 0..1. */
  confidence: number;
}

export interface Entity extends Traceable {
  id: string;
  name: string;
  entityType: EntityType;
  jurisdiction: string;
  county: string | null;
  city: string | null;
  metro: boolean;
  lat: number | null;
  lng: number | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Office extends Traceable {
  id: string;
  entityId: string;
  name: string;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact extends Traceable {
  id: string;
  entityId: string | null;
  officeId: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  /** Purchasing area this person owns, e.g. 'it_hardware' (Phase 3 org charts). */
  roleCategory: string | null;
  /** Seniority 0–100 for org-chart ranking. */
  titleRank: number | null;
  /** Published approval scope / dollar threshold, when stated. */
  authorityNote: string | null;
  /** Self-reference up the org chart. */
  reportsToContactId: string | null;
  isDecisionMaker: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetLine extends Traceable {
  id: string;
  entityId: string | null;
  program: string;
  categoryKeys: string[];
  fiscalPeriod: string | null;
  fund: string | null;
  amount: number | null;
  priorAmount: number | null;
  trendDelta: number | null;
  narrative: string | null;
  createdAt: string;
}

export interface OpportunityLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
}

export interface Opportunity extends Traceable {
  id: string;
  entityId: string | null;
  officeId: string | null;
  /** Source-native id, e.g. PeopleSoft event id. */
  externalId: string | null;
  title: string;
  description: string | null;
  status: OpportunityStatus;
  businessUnit: string | null;
  solicitationType: string | null;
  postedDate: string | null;
  dueDate: string | null;
  url: string | null;
  lineItems: OpportunityLineItem[];
  /** Category keys auto-tagged from text. */
  categoryKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Signal extends Traceable {
  id: string;
  entityId: string | null;
  opportunityId: string | null;
  signalType: SignalType;
  title: string;
  detail: string | null;
  /** Baseline strength 0..1 (seeded from signal type, adjustable per record). */
  strength: number;
  observedAt: string | null;
  url: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  key: string;
  label: string;
}

export interface SourceDocument {
  id: string;
  connectorId: string;
  url: string;
  contentType: string;
  body: string;
  sha256: string;
  fetchedAt: string;
  createdAt: string;
}

export interface EvidenceSpanRecord {
  id: string;
  sourceDocumentId: string;
  /** The normalized table the field lives in, e.g. `opportunities`. */
  targetTable: string;
  /** The id of the row in `targetTable` (null until the row is upserted). */
  targetId: string | null;
  /** The field name the snippet justifies, e.g. `title`. */
  field: string;
  locator: string;
  rawSnippet: string;
  extractedAt: string;
  createdAt: string;
}

export interface SellerProfile {
  id: string;
  companyName: string;
  capabilities: string[];
  services: string[];
  products: string[];
  keywords: string[];
  certifications: string[];
  /** Category keys the seller sells into. */
  categories: string[];
  /** Counties/cities/'statewide' the seller serves. */
  geographies: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single explained reason contributing to a match score. */
export interface MatchReason {
  factor: ScoreFactorKey;
  /** Points this factor contributed to the 0..100 score. */
  contribution: number;
  /** Human-readable justification, shown in the UI. */
  reason: string;
  /** Evidence spans (by id) that back this reason, when available. */
  evidenceSpanIds: string[];
}

export type MatchTargetType = 'opportunity' | 'entity';

export interface Match {
  id: string;
  sellerProfileId: string;
  targetType: MatchTargetType;
  targetId: string;
  /** Convenience denormalization for grouping in the UI. */
  entityId: string | null;
  /** 0..100. */
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
  createdAt: string;
}

export interface RefreshJob {
  id: string;
  connectorId: string;
  status: RefreshJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  documentsFetched: number;
  extractionsParsed: number;
  recordsUpserted: number;
  error: string | null;
  createdAt: string;
}
