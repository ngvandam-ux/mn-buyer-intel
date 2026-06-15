/**
 * Typed field contracts for connector extractions + builder helpers.
 *
 * Connectors emit `Extraction` objects whose loose `fields` follow these shapes. The
 * ingest layer reads exactly these field names, so parsers and ingestion agree without a
 * runtime schema. Entities/offices are referenced by name (`entityName`, `officeName`)
 * and resolved (find-or-create) during ingestion.
 */

import type {
  EntityType,
  EvidenceSpan,
  Extraction,
  ExtractionKind,
  OpportunityLineItem,
  OpportunityStatus,
  SignalType,
} from '@mn/core';

export interface EntityFields {
  name: string;
  entityType?: EntityType;
  jurisdiction?: string;
  county?: string | null;
  city?: string | null;
  metro?: boolean;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
}

export interface OfficeFields {
  name: string;
  entityName: string;
  entityType?: EntityType;
  url?: string | null;
}

export interface ContactFields {
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  entityName?: string;
  entityType?: EntityType;
  officeName?: string;
  /** Org-chart fields — left unset to be inferred from the title during ingest. */
  roleCategory?: string | null;
  titleRank?: number | null;
  authorityNote?: string | null;
  isDecisionMaker?: boolean;
}

export interface OpportunityFields {
  externalId?: string | null;
  title: string;
  description?: string | null;
  status?: OpportunityStatus;
  businessUnit?: string | null;
  /** Buyer org name — resolved to an entity. Defaults to the connector's entityHint org. */
  entityName?: string;
  entityType?: EntityType;
  officeName?: string;
  solicitationType?: string | null;
  postedDate?: string | null;
  dueDate?: string | null;
  url?: string | null;
  lineItems?: OpportunityLineItem[];
  /** Optional pre-tagged categories; ingest also auto-detects from text. */
  categoryKeys?: string[];
}

export interface SignalFields {
  signalType: SignalType;
  title: string;
  detail?: string | null;
  url?: string | null;
  observedAt?: string | null;
  entityName?: string;
  entityType?: EntityType;
  /** Override the signal-type baseline strength (0..1). */
  strength?: number;
}

export interface BudgetFields {
  entityName: string;
  entityType?: EntityType;
  program: string;
  categoryKeys?: string[];
  fiscalPeriod?: string | null;
  fund?: string | null;
  amount?: number | null;
  priorAmount?: number | null;
  trendDelta?: number | null;
  narrative?: string | null;
}

interface BuildOpts {
  confidence?: number;
  partial?: boolean;
}

function build(
  kind: ExtractionKind,
  fields: object,
  evidence: EvidenceSpan[],
  opts: BuildOpts = {},
): Extraction {
  return {
    kind,
    fields: fields as Record<string, unknown>,
    evidence,
    confidence: opts.confidence ?? 0.9,
    partial: opts.partial ?? false,
  };
}

export const extract = {
  entity: (f: EntityFields, ev: EvidenceSpan[], o?: BuildOpts) => build('entity', f, ev, o),
  office: (f: OfficeFields, ev: EvidenceSpan[], o?: BuildOpts) => build('office', f, ev, o),
  contact: (f: ContactFields, ev: EvidenceSpan[], o?: BuildOpts) => build('contact', f, ev, o),
  opportunity: (f: OpportunityFields, ev: EvidenceSpan[], o?: BuildOpts) =>
    build('opportunity', f, ev, o),
  signal: (f: SignalFields, ev: EvidenceSpan[], o?: BuildOpts) => build('signal', f, ev, o),
  budget: (f: BudgetFields, ev: EvidenceSpan[], o?: BuildOpts) => build('budget', f, ev, o),
};

// Typed re-reads of `fields` for the ingest layer.
export type ExtractionFieldsByKind = {
  entity: EntityFields;
  office: OfficeFields;
  contact: ContactFields;
  opportunity: OpportunityFields;
  signal: SignalFields;
  budget: BudgetFields;
};
