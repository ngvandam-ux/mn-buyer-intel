/**
 * API smoke test — boots Fastify against a temporary seeded PGlite and exercises the
 * routes via in-process injection.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mn-api-'));
process.env.DATABASE_URL = '';
process.env.PGLITE_DATA = DATA_DIR;
process.env.LOG_LEVEL = 'silent';

import { sourcewellConnector, supplierPortalConnector } from '@mn/connectors';
import { type DbHandle, createDb, runMigrations } from '@mn/db';
import { ingestFromFixture } from '@mn/ingest';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from './server.js';

let handle: DbHandle;
let app: FastifyInstance;

beforeAll(async () => {
  await runMigrations();
  handle = await createDb();
  await ingestFromFixture(handle.db, supplierPortalConnector);
  await ingestFromFixture(handle.db, sourcewellConnector);
  app = await buildServer(handle.db);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await handle?.close();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

const json = (r: { payload: string }) => JSON.parse(r.payload);

describe('API', () => {
  it('GET /api/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(json(res).ok).toBe(true);
  });

  it('GET /api/dashboard returns counts + source health', async () => {
    const d = json(await app.inject({ method: 'GET', url: '/api/dashboard' }));
    expect(d.counts.opportunities).toBeGreaterThan(0);
    expect(d.sourceHealth.length).toBeGreaterThanOrEqual(9);
    expect(Array.isArray(d.recentOpportunities)).toBe(true);
  });

  it('GET /api/opportunities filters by status', async () => {
    const all = json(await app.inject({ method: 'GET', url: '/api/opportunities' }));
    expect(all.length).toBeGreaterThan(0);
    const open = json(await app.inject({ method: 'GET', url: '/api/opportunities?status=open' }));
    expect(open.every((o: { status: string }) => o.status === 'open')).toBe(true);
  });

  it('GET /api/opportunities/:id returns detail with evidence', async () => {
    const all = json(await app.inject({ method: 'GET', url: '/api/opportunities' }));
    const detail = json(await app.inject({ method: 'GET', url: `/api/opportunities/${all[0].id}` }));
    expect(detail.opportunity.id).toBe(all[0].id);
    expect(Array.isArray(detail.evidence)).toBe(true);
    expect(detail.evidence.length).toBeGreaterThan(0);
    expect(detail.evidence[0].sourceUrl).toMatch(/^https?:\/\//);
  });

  it('POST /api/match/preview returns explainable, ranked matches', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/match/preview',
      payload: { companyName: 'Test Fiber Co', categories: ['telecom'], keywords: ['fiber', 'broadband'] },
    });
    const out = json(res);
    expect(Array.isArray(out.opportunityMatches)).toBe(true);
    // every match carries reasons
    for (const m of out.opportunityMatches) {
      expect(m.reasons.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(m.tier);
    }
  });

  it('POST + GET /api/seller-profiles persists and matches', async () => {
    const created = json(
      await app.inject({
        method: 'POST',
        url: '/api/seller-profiles',
        payload: { companyName: 'Granite Fleet', categories: ['fleet'], keywords: ['snowplow', 'vehicles'] },
      }),
    );
    expect(created.id).toBeTruthy();
    const matches = json(await app.inject({ method: 'GET', url: `/api/seller-profiles/${created.id}/matches` }));
    expect(matches.sellerProfileId).toBe(created.id);
    expect(Array.isArray(matches.opportunityMatches)).toBe(true);
  });
});
