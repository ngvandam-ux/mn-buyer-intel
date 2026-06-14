/**
 * Inferred row types + compile-time drift guards.
 *
 * The `_assert*` types fail to compile if a Drizzle row stops being assignable to its
 * canonical `@mn/core` domain model — catching schema/domain drift at typecheck time.
 */

import type {
  Contact as CoreContact,
  Entity as CoreEntity,
  Match as CoreMatch,
  Office as CoreOffice,
  Opportunity as CoreOpportunity,
  RefreshJob as CoreRefreshJob,
  SellerProfile as CoreSellerProfile,
  Signal as CoreSignal,
  SourceDocument as CoreSourceDocument,
} from '@mn/core';
import type {
  contacts,
  entities,
  matches,
  offices,
  opportunities,
  refreshJobs,
  sellerProfiles,
  signals,
  sourceDocuments,
} from './schema.js';

export type EntityRow = typeof entities.$inferSelect;
export type EntityInsert = typeof entities.$inferInsert;
export type OfficeRow = typeof offices.$inferSelect;
export type OfficeInsert = typeof offices.$inferInsert;
export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
export type OpportunityRow = typeof opportunities.$inferSelect;
export type OpportunityInsert = typeof opportunities.$inferInsert;
export type SignalRow = typeof signals.$inferSelect;
export type SignalInsert = typeof signals.$inferInsert;
export type SourceDocumentRow = typeof sourceDocuments.$inferSelect;
export type SourceDocumentInsert = typeof sourceDocuments.$inferInsert;
export type SellerProfileRow = typeof sellerProfiles.$inferSelect;
export type SellerProfileInsert = typeof sellerProfiles.$inferInsert;
export type MatchRow = typeof matches.$inferSelect;
export type MatchInsert = typeof matches.$inferInsert;
export type RefreshJobRow = typeof refreshJobs.$inferSelect;
export type RefreshJobInsert = typeof refreshJobs.$inferInsert;

// `U extends T ? U : never` — errors if a row stops conforming to the domain model.
type AssertAssignable<T, U extends T> = U;

export type _assertEntity = AssertAssignable<CoreEntity, EntityRow>;
export type _assertOffice = AssertAssignable<CoreOffice, OfficeRow>;
export type _assertContact = AssertAssignable<CoreContact, ContactRow>;
export type _assertOpportunity = AssertAssignable<CoreOpportunity, OpportunityRow>;
export type _assertSignal = AssertAssignable<CoreSignal, SignalRow>;
export type _assertSourceDocument = AssertAssignable<CoreSourceDocument, SourceDocumentRow>;
export type _assertSellerProfile = AssertAssignable<CoreSellerProfile, SellerProfileRow>;
export type _assertMatch = AssertAssignable<CoreMatch, MatchRow>;
export type _assertRefreshJob = AssertAssignable<CoreRefreshJob, RefreshJobRow>;
