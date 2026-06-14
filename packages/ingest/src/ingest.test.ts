/**
 * Ingest integration test against a real (temporary, file-backed) PGlite database.
 * Proves the full pipeline: parse fixture → upsert entities/opportunities/signals →
 * write evidence → idempotent re-run.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the db driver at a throwaway PGlite dir BEFORE any db call.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'mn-ingest-'));
process.env.DATABASE_URL = '';
process.env.PGLITE_DATA = DATA_DIR;

import {
  mmbBudgetConnector,
  ospContactsConnector,
  sourcewellConnector,
  supplierPortalConnector,
} from '@mn/connectors';
import {
  type DbHandle,
  budgetLines,
  contacts,
  createDb,
  entities,
  evidenceSpans,
  opportunities,
  runMigrations,
  signals,
} from '@mn/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ingestFromFixture } from './ingest.js';

let handle: DbHandle;

beforeAll(async () => {
  await runMigrations();
  handle = await createDb();
}, 60_000);

afterAll(async () => {
  await handle?.close();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe('ingest pipeline', () => {
  it('ingests supplier portal opportunities with entities, signals, and evidence', async () => {
    const summary = await ingestFromFixture(handle.db, supplierPortalConnector);
    expect(summary).not.toBeNull();
    expect(summary!.status).toBe('success');

    const opps = await handle.db.select().from(opportunities);
    expect(opps.length).toBeGreaterThanOrEqual(30);
    // every opportunity is traceable
    expect(opps.every((o) => o.sourceDocumentId !== null)).toBe(true);
    // categories were auto-tagged on at least some
    expect(opps.some((o) => o.categoryKeys.length > 0)).toBe(true);

    const ents = await handle.db.select().from(entities);
    expect(ents.length).toBeGreaterThanOrEqual(5);

    // open/upcoming opportunities derive solicitation signals
    const sigs = await handle.db.select().from(signals);
    expect(sigs.some((s) => s.signalType === 'open_solicitation' || s.signalType === 'upcoming_event')).toBe(
      true,
    );

    // evidence chain exists and points at opportunities
    const ev = await handle.db.select().from(evidenceSpans);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.some((e) => e.targetTable === 'opportunities')).toBe(true);
  });

  it('is idempotent — re-ingesting does not duplicate', async () => {
    const before = (await handle.db.select().from(opportunities)).length;
    await ingestFromFixture(handle.db, supplierPortalConnector);
    const after = (await handle.db.select().from(opportunities)).length;
    expect(after).toBe(before);
  });

  it('ingests sourcewell cooperative opportunities + pathway signal', async () => {
    await ingestFromFixture(handle.db, sourcewellConnector);
    const coop = (await handle.db.select().from(entities)).find((e) => e.name === 'Sourcewell');
    expect(coop).toBeDefined();
    expect(coop!.entityType).toBe('cooperative_purchasing');
    const sigs = await handle.db.select().from(signals);
    expect(sigs.some((s) => s.signalType === 'cooperative_pathway')).toBe(true);
  });

  it('ingests MMB budget into budget_lines + a budget_priority signal', async () => {
    await ingestFromFixture(handle.db, mmbBudgetConnector);
    const lines = await handle.db.select().from(budgetLines);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const mnit = lines.find((l) => l.categoryKeys.includes('software'));
    expect(mnit).toBeDefined();
    expect(mnit!.amount ?? 0).toBeGreaterThan(100_000_000);
    expect(mnit!.fiscalPeriod).toBe('FY2026-27');
    const sigs = await handle.db.select().from(signals);
    expect(sigs.some((s) => s.signalType === 'budget_priority')).toBe(true);
  });

  it('ingests OSP contacts with contact_exposure signals', async () => {
    await ingestFromFixture(handle.db, ospContactsConnector);
    const cs = await handle.db.select().from(contacts);
    expect(cs.length).toBeGreaterThanOrEqual(4);
    expect(cs.some((c) => c.email?.includes('@'))).toBe(true);
    const sigs = await handle.db.select().from(signals);
    expect(sigs.some((s) => s.signalType === 'contact_exposure')).toBe(true);
  });
});
