/**
 * Parser tests run against the committed real-source fixtures. They assert structural
 * invariants (every opportunity has a title + id, dates are ISO-or-null, evidence is
 * attached) plus a few concrete values from the captured snapshots. If a fixture is
 * recaptured and a concrete value changes, update the corresponding assertion.
 */

import type { Extraction, SourceConnector } from '@mn/core';
import { describe, expect, it } from 'vitest';
import { fixtureAsRawDocument } from '../runtime/fixtures.js';
import { minnstateConnector } from './minnstate.js';
import { ospContactsConnector } from './osp-contacts.js';
import { ospSolicitationsConnector } from './osp-solicitations.js';
import { sourcewellConnector } from './sourcewell.js';
import { supplierPortalConnector } from './supplier-portal.js';
import { umnConnector } from './umn.js';

async function parseFixture(connector: SourceConnector): Promise<Extraction[]> {
  const raw = fixtureAsRawDocument(connector.meta.id, connector.meta.url);
  if (!raw) throw new Error(`missing fixture for ${connector.meta.id}`);
  return Promise.resolve(connector.parse(raw));
}

const byKind = (ex: Extraction[], kind: Extraction['kind']) => ex.filter((e) => e.kind === kind);
const isIsoOrNull = (v: unknown) => v === null || (typeof v === 'string' && !Number.isNaN(Date.parse(v)));

describe('supplier-portal parser', () => {
  it('extracts bid events with evidence', async () => {
    const ex = await parseFixture(supplierPortalConnector);
    const opps = byKind(ex, 'opportunity');
    expect(opps.length).toBeGreaterThanOrEqual(30);
    for (const o of opps) {
      const f = o.fields as Record<string, unknown>;
      expect(typeof f.title).toBe('string');
      expect(String(f.title).length).toBeGreaterThan(0);
      expect(String(f.externalId)).toMatch(/^\d+$/);
      expect(typeof f.entityName).toBe('string');
      expect(['open', 'upcoming', 'closed']).toContain(f.status);
      expect(isIsoOrNull(f.dueDate)).toBe(true);
      expect(isIsoOrNull(f.postedDate)).toBe(true);
      expect(o.evidence.length).toBeGreaterThan(0);
      expect(o.evidence[0]!.rawSnippet.length).toBeGreaterThan(0);
    }
  });

  it('emits unique state-agency entities from business units', async () => {
    const ex = await parseFixture(supplierPortalConnector);
    const entities = byKind(ex, 'entity');
    expect(entities.length).toBeGreaterThanOrEqual(5);
    expect(entities.every((e) => (e.fields as { entityType: string }).entityType === 'state_agency')).toBe(true);
    const names = entities.map((e) => (e.fields as { name: string }).name);
    expect(names).toContain('Veterans Affairs Department');
  });
});

describe('sourcewell parser', () => {
  it('extracts cooperative solicitations with status + url', async () => {
    const ex = await parseFixture(sourcewellConnector);
    const opps = byKind(ex, 'opportunity');
    expect(opps.length).toBeGreaterThanOrEqual(10);
    for (const o of opps) {
      const f = o.fields as Record<string, unknown>;
      expect(String(f.externalId)).toMatch(/^\d+$/);
      expect(String(f.url)).toMatch(/^https:\/\//);
      expect(['open', 'upcoming', 'awarded']).toContain(f.status);
    }
    const titles = opps.map((o) => (o.fields as { title: string }).title);
    expect(titles).toContain('Law Enforcement Equipment');
  });

  it('emits a cooperative_pathway signal and the Sourcewell entity', async () => {
    const ex = await parseFixture(sourcewellConnector);
    expect(byKind(ex, 'signal').some((s) => (s.fields as { signalType: string }).signalType === 'cooperative_pathway')).toBe(true);
    expect(byKind(ex, 'entity').some((e) => (e.fields as { name: string }).name === 'Sourcewell')).toBe(true);
  });
});

describe('osp-solicitations parser', () => {
  it('emits the OSP entity and section signals incl. expiring_contract', async () => {
    const ex = await parseFixture(ospSolicitationsConnector);
    expect(byKind(ex, 'entity').length).toBeGreaterThanOrEqual(1);
    const signalTypes = byKind(ex, 'signal').map((s) => (s.fields as { signalType: string }).signalType);
    expect(signalTypes).toContain('expiring_contract');
    expect(signalTypes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('osp-contacts parser', () => {
  it('extracts named contacts with email/phone and offices', async () => {
    const ex = await parseFixture(ospContactsConnector);
    const contacts = byKind(ex, 'contact');
    expect(contacts.length).toBeGreaterThanOrEqual(4);
    for (const c of contacts) {
      const f = c.fields as Record<string, unknown>;
      expect(String(f.email)).toMatch(/@/);
      expect(String(f.name)).toMatch(/\S+\s+\S+/);
    }
    expect(contacts.some((c) => (c.fields as { phone?: string }).phone)).toBe(true);
    expect(byKind(ex, 'office').length).toBeGreaterThanOrEqual(1);
    expect(contacts.some((c) => (c.fields as { email: string }).email === 'Rachel.Dougherty@state.mn.us')).toBe(true);
  });
});

describe('minnstate parser', () => {
  it('extracts entity, office, contacts and signals', async () => {
    const ex = await parseFixture(minnstateConnector);
    expect(byKind(ex, 'entity').length).toBe(1);
    expect(byKind(ex, 'office').length).toBe(1);
    expect(byKind(ex, 'contact').length).toBeGreaterThanOrEqual(1);
    expect(byKind(ex, 'signal').length).toBeGreaterThanOrEqual(1);
  });
});

describe('umn parser', () => {
  it('extracts entity, office and a pathway signal', async () => {
    const ex = await parseFixture(umnConnector);
    expect(byKind(ex, 'entity').length).toBe(1);
    expect(byKind(ex, 'office').length).toBe(1);
    expect(byKind(ex, 'signal').length).toBeGreaterThanOrEqual(1);
  });
});
