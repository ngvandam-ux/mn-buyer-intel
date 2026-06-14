/**
 * Normalized schema — single source of truth for the database shape.
 *
 * Written in Drizzle `pg-core` (canonical Postgres). Dev runs it on PGlite, prod on a
 * normal Postgres; the schema is identical. Controlled-vocabulary columns are `text`
 * narrowed with `$type<...>()` to the `@mn/core` taxonomy, so we get strong types
 * without the migration friction of native PG enums.
 *
 * Every extracted table carries the traceability triplet:
 *   source_document_id → extracted_at → confidence
 * and links fields to raw snippets through `evidence_spans`.
 */

import type {
  EntityType,
  MatchTargetType,
  MatchTier,
  OpportunityLineItem,
  OpportunityStatus,
  MatchReason,
  RefreshJobStatus,
  SignalType,
} from '@mn/core';
import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString());
const extractedAt = () =>
  timestamp('extracted_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull();

// ---------------------------------------------------------------------------
// source_documents — raw captured responses, stored verbatim.
// ---------------------------------------------------------------------------

export const sourceDocuments = pgTable(
  'source_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectorId: text('connector_id').notNull(),
    url: text('url').notNull(),
    contentType: text('content_type').notNull(),
    body: text('body').notNull(),
    sha256: text('sha256').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('source_documents_connector_idx').on(t.connectorId),
    index('source_documents_sha_idx').on(t.sha256),
  ],
);

// ---------------------------------------------------------------------------
// evidence_spans — ties any normalized field to an exact source snippet.
// ---------------------------------------------------------------------------

export const evidenceSpans = pgTable(
  'evidence_spans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: 'cascade' }),
    targetTable: text('target_table').notNull(),
    targetId: uuid('target_id'),
    field: text('field').notNull(),
    locator: text('locator').notNull(),
    rawSnippet: text('raw_snippet').notNull(),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('evidence_spans_doc_idx').on(t.sourceDocumentId),
    index('evidence_spans_target_idx').on(t.targetTable, t.targetId),
  ],
);

// ---------------------------------------------------------------------------
// entities — public buyer organizations.
// ---------------------------------------------------------------------------

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    entityType: text('entity_type').$type<EntityType>().notNull(),
    jurisdiction: text('jurisdiction').notNull().default('MN'),
    county: text('county'),
    city: text('city'),
    metro: boolean('metro').notNull().default(false),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    website: text('website'),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('entities_type_idx').on(t.entityType),
    index('entities_jurisdiction_idx').on(t.jurisdiction),
    index('entities_name_idx').on(t.name),
  ],
);

// ---------------------------------------------------------------------------
// offices — procurement offices within an entity.
// ---------------------------------------------------------------------------

export const offices = pgTable(
  'offices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url'),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('offices_entity_idx').on(t.entityId)],
);

// ---------------------------------------------------------------------------
// contacts — named procurement people.
// ---------------------------------------------------------------------------

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    officeId: uuid('office_id').references(() => offices.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    title: text('title'),
    email: text('email'),
    phone: text('phone'),
    // Org-chart / decision-maker fields (Phase 3).
    roleCategory: text('role_category'),
    titleRank: integer('title_rank'),
    authorityNote: text('authority_note'),
    reportsToContactId: uuid('reports_to_contact_id').references((): AnyPgColumn => contacts.id, {
      onDelete: 'set null',
    }),
    isDecisionMaker: boolean('is_decision_maker').notNull().default(false),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('contacts_entity_idx').on(t.entityId), index('contacts_office_idx').on(t.officeId)],
);

// ---------------------------------------------------------------------------
// categories — controlled purchasing categories (seeded from the taxonomy).
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  label: text('label').notNull(),
});

// ---------------------------------------------------------------------------
// opportunities — solicitations / bids / contract opportunities.
// ---------------------------------------------------------------------------

export const opportunities = pgTable(
  'opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
    officeId: uuid('office_id').references(() => offices.id, { onDelete: 'set null' }),
    externalId: text('external_id'),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<OpportunityStatus>().notNull().default('unknown'),
    businessUnit: text('business_unit'),
    solicitationType: text('solicitation_type'),
    postedDate: timestamp('posted_date', { withTimezone: true, mode: 'string' }),
    dueDate: timestamp('due_date', { withTimezone: true, mode: 'string' }),
    url: text('url'),
    lineItems: jsonb('line_items').$type<OpportunityLineItem[]>().notNull().default(sql`'[]'::jsonb`),
    categoryKeys: text('category_keys').array().notNull().default(sql`ARRAY[]::text[]`),
    // Reserved for the future semantic layer (stored as JSON for now so the schema runs on
    // any Postgres). Swap to a pgvector `vector(1536)` column when semantic search is
    // enabled — verified working on PGlite in dev. Nullable + unused by the v1 matcher.
    embedding: jsonb('embedding').$type<number[]>(),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('opportunities_entity_idx').on(t.entityId),
    index('opportunities_status_idx').on(t.status),
    index('opportunities_external_idx').on(t.externalId),
    index('opportunities_due_idx').on(t.dueDate),
  ],
);

// opportunity ↔ category join (m:n).
export const opportunityCategories = pgTable(
  'opportunity_categories',
  {
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.categoryId] })],
);

// ---------------------------------------------------------------------------
// signals — typed buying signals.
// ---------------------------------------------------------------------------

export const signals = pgTable(
  'signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    opportunityId: uuid('opportunity_id').references(() => opportunities.id, {
      onDelete: 'cascade',
    }),
    signalType: text('signal_type').$type<SignalType>().notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    strength: real('strength').notNull().default(0.5),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'string' }),
    url: text('url'),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('signals_entity_idx').on(t.entityId),
    index('signals_opportunity_idx').on(t.opportunityId),
    index('signals_type_idx').on(t.signalType),
  ],
);

// ---------------------------------------------------------------------------
// budget_lines — quantitative budget / appropriation intel (Phase 1).
// ---------------------------------------------------------------------------

export const budgetLines = pgTable(
  'budget_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'cascade' }),
    program: text('program').notNull(),
    categoryKeys: text('category_keys').array().notNull().default(sql`ARRAY[]::text[]`),
    fiscalPeriod: text('fiscal_period'),
    fund: text('fund'),
    amount: doublePrecision('amount'),
    priorAmount: doublePrecision('prior_amount'),
    trendDelta: doublePrecision('trend_delta'),
    narrative: text('narrative'),
    sourceDocumentId: uuid('source_document_id').references(() => sourceDocuments.id, {
      onDelete: 'set null',
    }),
    confidence: real('confidence').notNull().default(1),
    extractedAt: extractedAt(),
    createdAt: createdAt(),
  },
  (t) => [
    index('budget_lines_entity_idx').on(t.entityId),
    index('budget_lines_period_idx').on(t.fiscalPeriod),
  ],
);

// ---------------------------------------------------------------------------
// seller_profiles — the user's company capabilities.
// ---------------------------------------------------------------------------

export const sellerProfiles = pgTable('seller_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: text('company_name').notNull(),
  capabilities: text('capabilities').array().notNull().default(sql`ARRAY[]::text[]`),
  services: text('services').array().notNull().default(sql`ARRAY[]::text[]`),
  products: text('products').array().notNull().default(sql`ARRAY[]::text[]`),
  keywords: text('keywords').array().notNull().default(sql`ARRAY[]::text[]`),
  certifications: text('certifications').array().notNull().default(sql`ARRAY[]::text[]`),
  categories: text('categories').array().notNull().default(sql`ARRAY[]::text[]`),
  geographies: text('geographies').array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// matches — seller ↔ buyer/opportunity with explainable reasons.
// ---------------------------------------------------------------------------

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerProfileId: uuid('seller_profile_id')
      .notNull()
      .references(() => sellerProfiles.id, { onDelete: 'cascade' }),
    targetType: text('target_type').$type<MatchTargetType>().notNull(),
    targetId: uuid('target_id').notNull(),
    entityId: uuid('entity_id').references(() => entities.id, { onDelete: 'set null' }),
    score: real('score').notNull(),
    tier: text('tier').$type<MatchTier>().notNull(),
    reasons: jsonb('reasons').$type<MatchReason[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('matches_seller_idx').on(t.sellerProfileId),
    index('matches_target_idx').on(t.targetType, t.targetId),
    index('matches_tier_idx').on(t.tier),
  ],
);

// ---------------------------------------------------------------------------
// refresh_jobs — one row per connector run.
// ---------------------------------------------------------------------------

export const refreshJobs = pgTable(
  'refresh_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectorId: text('connector_id').notNull(),
    status: text('status').$type<RefreshJobStatus>().notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
    documentsFetched: integer('documents_fetched').notNull().default(0),
    extractionsParsed: integer('extractions_parsed').notNull().default(0),
    recordsUpserted: integer('records_upserted').notNull().default(0),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [
    index('refresh_jobs_connector_idx').on(t.connectorId),
    index('refresh_jobs_status_idx').on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// relations (for drizzle relational queries)
// ---------------------------------------------------------------------------

export const entitiesRelations = relations(entities, ({ many }) => ({
  offices: many(offices),
  contacts: many(contacts),
  opportunities: many(opportunities),
  signals: many(signals),
  budgetLines: many(budgetLines),
}));

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  entity: one(entities, { fields: [budgetLines.entityId], references: [entities.id] }),
}));

export const officesRelations = relations(offices, ({ one, many }) => ({
  entity: one(entities, { fields: [offices.entityId], references: [entities.id] }),
  contacts: many(contacts),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  entity: one(entities, { fields: [contacts.entityId], references: [entities.id] }),
  office: one(offices, { fields: [contacts.officeId], references: [offices.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  entity: one(entities, { fields: [opportunities.entityId], references: [entities.id] }),
  office: one(offices, { fields: [opportunities.officeId], references: [offices.id] }),
  signals: many(signals),
  opportunityCategories: many(opportunityCategories),
}));

export const opportunityCategoriesRelations = relations(opportunityCategories, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunityCategories.opportunityId],
    references: [opportunities.id],
  }),
  category: one(categories, {
    fields: [opportunityCategories.categoryId],
    references: [categories.id],
  }),
}));

export const signalsRelations = relations(signals, ({ one }) => ({
  entity: one(entities, { fields: [signals.entityId], references: [entities.id] }),
  opportunity: one(opportunities, {
    fields: [signals.opportunityId],
    references: [opportunities.id],
  }),
}));

export const evidenceSpansRelations = relations(evidenceSpans, ({ one }) => ({
  sourceDocument: one(sourceDocuments, {
    fields: [evidenceSpans.sourceDocumentId],
    references: [sourceDocuments.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  sellerProfile: one(sellerProfiles, {
    fields: [matches.sellerProfileId],
    references: [sellerProfiles.id],
  }),
  entity: one(entities, { fields: [matches.entityId], references: [entities.id] }),
}));

// ---------------------------------------------------------------------------
// table registry (handy for generic tooling / tests)
// ---------------------------------------------------------------------------

export const tables = {
  sourceDocuments,
  evidenceSpans,
  entities,
  offices,
  contacts,
  categories,
  opportunities,
  opportunityCategories,
  signals,
  budgetLines,
  sellerProfiles,
  matches,
  refreshJobs,
};
