/**
 * Ingestion orchestrator: connector → raw store → normalize → upsert → refresh_job.
 *
 * Two entry points share one core:
 *   - {@link ingestConnector}    live fetch via a FetchContext
 *   - {@link ingestFromFixture}  offline parse of the newest committed fixture (seeding)
 *
 * The database is the only state; this module is otherwise pure orchestration.
 */

import type { Extraction, RawDocument, SourceConnector } from '@mn/core';
import { fixtureAsRawDocument } from '@mn/connectors';
import type { FetchContext } from '@mn/core';
import {
  type AppDatabase,
  and,
  eq,
  evidenceSpans,
  refreshJobs,
  sourceDocuments,
} from '@mn/db';
import {
  type NormalizeContext,
  ensureCategories,
  processContact,
  processEntity,
  processOffice,
  processOpportunity,
  processSignal,
} from './normalize.js';

export interface IngestSummary {
  connectorId: string;
  refreshJobId: string;
  status: 'success' | 'partial' | 'error';
  documentsFetched: number;
  extractionsParsed: number;
  recordsUpserted: number;
  error: string | null;
}

async function findOrInsertSourceDocument(db: AppDatabase, doc: RawDocument): Promise<string> {
  const found = await db
    .select({ id: sourceDocuments.id })
    .from(sourceDocuments)
    .where(and(eq(sourceDocuments.connectorId, doc.connectorId), eq(sourceDocuments.sha256, doc.sha256)))
    .limit(1);
  if (found[0]) return found[0].id;
  const [row] = await db
    .insert(sourceDocuments)
    .values({
      connectorId: doc.connectorId,
      url: doc.url,
      contentType: doc.contentType,
      body: doc.body,
      sha256: doc.sha256,
      fetchedAt: doc.fetchedAt,
    })
    .returning();
  return row!.id;
}

// Process extractions in dependency order so name references resolve.
const KIND_ORDER: Array<Extraction['kind']> = ['entity', 'office', 'contact', 'opportunity', 'signal'];

async function processExtraction(ctx: NormalizeContext, ex: Extraction): Promise<void> {
  switch (ex.kind) {
    case 'entity':
      return processEntity(ctx, ex);
    case 'office':
      return processOffice(ctx, ex);
    case 'contact':
      return processContact(ctx, ex);
    case 'opportunity':
      return processOpportunity(ctx, ex);
    case 'signal':
      return processSignal(ctx, ex);
  }
}

/** Core: persist a set of raw documents for a connector, with a refresh_job record. */
export async function runIngest(
  db: AppDatabase,
  connector: SourceConnector,
  rawDocs: RawDocument[],
): Promise<IngestSummary> {
  const startedAt = new Date().toISOString();
  const [job] = await db
    .insert(refreshJobs)
    .values({ connectorId: connector.meta.id, status: 'running', startedAt })
    .returning();
  const refreshJobId = job!.id;

  const entityCache = new Map<string, string>();
  const officeCache = new Map<string, string>();
  const categoryCache = new Map<string, string>();
  const counts = { upserted: 0 };
  let extractionsParsed = 0;

  try {
    await ensureCategories(db, categoryCache);

    for (const doc of rawDocs) {
      const sourceDocumentId = await findOrInsertSourceDocument(db, doc);
      // Clear stale evidence for this document, then rewrite it fresh.
      await db.delete(evidenceSpans).where(eq(evidenceSpans.sourceDocumentId, sourceDocumentId));

      const extractions = await Promise.resolve(connector.parse(doc));
      extractionsParsed += extractions.length;
      const ctx: NormalizeContext = {
        db,
        sourceDocumentId,
        at: doc.fetchedAt,
        entityCache,
        officeCache,
        categoryCache,
        counts,
      };
      for (const kind of KIND_ORDER) {
        for (const ex of extractions) {
          if (ex.kind === kind) await processExtraction(ctx, ex);
        }
      }
    }

    const status: IngestSummary['status'] =
      connector.meta.live && rawDocs.length > 0 && extractionsParsed === 0 ? 'partial' : 'success';
    await db
      .update(refreshJobs)
      .set({
        status,
        finishedAt: new Date().toISOString(),
        documentsFetched: rawDocs.length,
        extractionsParsed,
        recordsUpserted: counts.upserted,
      })
      .where(eq(refreshJobs.id, refreshJobId));

    return {
      connectorId: connector.meta.id,
      refreshJobId,
      status,
      documentsFetched: rawDocs.length,
      extractionsParsed,
      recordsUpserted: counts.upserted,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(refreshJobs)
      .set({
        status: 'error',
        finishedAt: new Date().toISOString(),
        documentsFetched: rawDocs.length,
        extractionsParsed,
        recordsUpserted: counts.upserted,
        error: message,
      })
      .where(eq(refreshJobs.id, refreshJobId));
    return {
      connectorId: connector.meta.id,
      refreshJobId,
      status: 'error',
      documentsFetched: rawDocs.length,
      extractionsParsed,
      recordsUpserted: counts.upserted,
      error: message,
    };
  }
}

/** Live ingest: fetch from the source, then normalize. */
export async function ingestConnector(
  db: AppDatabase,
  connector: SourceConnector,
  ctx: FetchContext,
): Promise<IngestSummary> {
  let rawDocs: RawDocument[];
  try {
    rawDocs = await connector.fetch(ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [job] = await db
      .insert(refreshJobs)
      .values({
        connectorId: connector.meta.id,
        status: 'error',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: `fetch failed: ${message}`,
      })
      .returning();
    return {
      connectorId: connector.meta.id,
      refreshJobId: job!.id,
      status: 'error',
      documentsFetched: 0,
      extractionsParsed: 0,
      recordsUpserted: 0,
      error: `fetch failed: ${message}`,
    };
  }
  return runIngest(db, connector, rawDocs);
}

/** Offline ingest from the newest committed fixture (used by seeding/tests). */
export async function ingestFromFixture(
  db: AppDatabase,
  connector: SourceConnector,
): Promise<IngestSummary | null> {
  const doc = fixtureAsRawDocument(connector.meta.id, connector.meta.url);
  if (!doc) return null;
  return runIngest(db, connector, [doc]);
}
