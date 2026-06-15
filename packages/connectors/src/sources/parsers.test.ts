/**
 * Parser tests run against the committed real-source fixtures. They assert structural
 * invariants (every opportunity has a title + id, dates are ISO-or-null, evidence is
 * attached) plus a few concrete values from the captured snapshots. If a fixture is
 * recaptured and a concrete value changes, update the corresponding assertion.
 */

import type { Extraction, SourceConnector } from '@mn/core';
import { describe, expect, it } from 'vitest';
import { fixtureAsRawDocument } from '../runtime/fixtures.js';
import { metroCountiesConnector } from './metro-counties.js';
import { orgChartsConnector } from './org-charts.js';
import { minnstateConnector } from './minnstate.js';
import { mmbBudgetConnector } from './mmb-budget.js';
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

describe('mmb-budget parser', () => {
  const MNIT_URL =
    'https://mn.gov/mmb-stat/documents/budget/2026-27-biennial-budget-books/governors-revised-march/mn-it-services.pdf';
  it('extracts an agency budget line + priorities from the budget book PDF text', async () => {
    const raw = fixtureAsRawDocument('mn-mmb-budget', MNIT_URL);
    if (!raw) throw new Error('missing mn-mmb-budget fixture');
    const ex = await Promise.resolve(mmbBudgetConnector.parse(raw));
    const budgets = byKind(ex, 'budget');
    expect(budgets.length).toBe(1);
    const f = budgets[0]!.fields as Record<string, unknown>;
    expect(f.entityName).toBe('Minnesota IT Services');
    expect(Number(f.amount)).toBeGreaterThan(100_000_000);
    expect(f.categoryKeys as string[]).toContain('software');
    expect(f.fiscalPeriod).toBe('FY2026-27');
    const signalTypes = byKind(ex, 'signal').map((s) => (s.fields as { signalType: string }).signalType);
    expect(signalTypes).toContain('budget_priority');
    expect(signalTypes).toContain('strategic_initiative');
    expect(byKind(ex, 'entity').length).toBe(1);
  });
});

describe('metro-counties parser', () => {
  it('emits all 7 metro county buyers (with coords) + a pathway signal', async () => {
    const raw = fixtureAsRawDocument('mn-metro-counties', metroCountiesConnector.meta.url);
    if (!raw) throw new Error('missing mn-metro-counties fixture');
    const ex = await Promise.resolve(metroCountiesConnector.parse(raw));
    const ents = byKind(ex, 'entity');
    expect(ents.length).toBe(7);
    expect(ents.every((e) => (e.fields as { entityType: string }).entityType === 'county')).toBe(true);
    expect(ents.every((e) => (e.fields as { metro: boolean }).metro === true)).toBe(true);
    expect(ents.every((e) => typeof (e.fields as { lat: number }).lat === 'number')).toBe(true);
    const names = ents.map((e) => (e.fields as { name: string }).name);
    expect(names).toContain('Hennepin County');
    expect(names).toContain('Ramsey County');
    expect(byKind(ex, 'signal').some((s) => (s.fields as { signalType: string }).signalType === 'cooperative_pathway')).toBe(true);
  });
});

describe('org-charts parser', () => {
  it('extracts named MNIT decision-makers present on the leadership page', async () => {
    const raw = fixtureAsRawDocument('mn-org-charts', orgChartsConnector.meta.url);
    if (!raw) throw new Error('missing mn-org-charts fixture');
    const ex = await Promise.resolve(orgChartsConnector.parse(raw));
    const contacts = byKind(ex, 'contact');
    expect(contacts.length).toBeGreaterThanOrEqual(3);
    const names = contacts.map((c) => (c.fields as { name: string }).name);
    expect(names).toContain('Jon Eichten');
    expect(contacts.every((c) => (c.fields as { title: string }).title.length > 0)).toBe(true);
    expect(byKind(ex, 'entity').some((e) => (e.fields as { name: string }).name === 'Minnesota IT Services')).toBe(true);
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
