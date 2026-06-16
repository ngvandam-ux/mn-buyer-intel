/**
 * Parser tests run against the committed real-source fixtures. They assert structural
 * invariants (every opportunity has a title + id, dates are ISO-or-null, evidence is
 * attached) plus a few concrete values from the captured snapshots. If a fixture is
 * recaptured and a concrete value changes, update the corresponding assertion.
 */

import type { Extraction, SourceConnector } from '@mn/core';
import { describe, expect, it } from 'vitest';
import { fixtureAsRawDocument, fixtureDocsForConnector } from '../runtime/fixtures.js';
import { incumbentsConnector } from './incumbents.js';
import { metroCouncilConnector } from './metro-council.js';
import { metroCountiesConnector } from './metro-counties.js';
import { mndotConnector } from './mndot.js';
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
  it('extracts per-agency budget lines + capability-demand signals across agencies', () => {
    // Connector content-identifies each agency PDF; parse all committed budget fixtures.
    const docs = fixtureDocsForConnector('mn-mmb-budget', mmbBudgetConnector.meta.url);
    expect(docs.length).toBeGreaterThanOrEqual(2);
    const all = docs.flatMap((d) => mmbBudgetConnector.parse(d) as Extraction[]);
    const budgets = byKind(all, 'budget');
    expect(budgets.length).toBeGreaterThanOrEqual(2);

    const mnit = budgets.find((b) => (b.fields as { entityName: string }).entityName === 'Minnesota IT Services');
    expect(mnit).toBeDefined();
    const f = mnit!.fields as Record<string, unknown>;
    expect(Number(f.amount)).toBeGreaterThan(100_000_000);
    expect(f.categoryKeys as string[]).toContain('software');
    expect(f.fiscalPeriod).toBe('FY2026-27');

    // Capability-demand signals ("X demand: <capability>") are emitted.
    const caps = byKind(all, 'signal').filter((s) => /demand:/.test((s.fields as { title: string }).title));
    expect(caps.length).toBeGreaterThanOrEqual(5);
    expect(byKind(all, 'signal').some((s) => (s.fields as { signalType: string }).signalType === 'budget_priority')).toBe(true);
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

describe('metro-council parser', () => {
  it('extracts Met Council solicitations (RFP/IFB) with dates, type, and the entity', async () => {
    const ex = await parseFixture(metroCouncilConnector);
    const opps = byKind(ex, 'opportunity');
    expect(opps.length).toBeGreaterThanOrEqual(5);
    for (const o of opps) {
      const f = o.fields as Record<string, unknown>;
      expect(String(f.title).length).toBeGreaterThan(0);
      expect(String(f.externalId).length).toBeGreaterThan(0);
      expect(String(f.url)).toMatch(/^https:\/\//);
      expect(f.status).toBe('open');
      expect(['RFP', 'IFB']).toContain(f.solicitationType);
      expect(isIsoOrNull(f.dueDate)).toBe(true);
      expect(isIsoOrNull(f.postedDate)).toBe(true);
      expect(o.evidence[0]!.rawSnippet.length).toBeGreaterThan(0);
    }
    expect(
      byKind(ex, 'entity').some((e) => (e.fields as { name: string }).name === 'Metropolitan Council'),
    ).toBe(true);
  });
});

describe('mndot parser', () => {
  it('extracts MnDOT P/T consultant solicitations with posted/due dates + the entity', async () => {
    const ex = await parseFixture(mndotConnector);
    const opps = byKind(ex, 'opportunity');
    expect(opps.length).toBeGreaterThanOrEqual(3);
    for (const o of opps) {
      const f = o.fields as Record<string, unknown>;
      expect(String(f.title).length).toBeGreaterThan(3);
      expect(f.status).toBe('open');
      expect(String(f.url)).toMatch(/^https:\/\//);
      expect(isIsoOrNull(f.dueDate)).toBe(true);
      expect(isIsoOrNull(f.postedDate)).toBe(true);
      expect(o.evidence[0]!.rawSnippet).toMatch(/posted/);
    }
    expect(
      byKind(ex, 'entity').some(
        (e) => (e.fields as { name: string }).name === 'Minnesota Department of Transportation',
      ),
    ).toBe(true);
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

describe('incumbents parser', () => {
  it('extracts awarded vendors (incumbents) per Sourcewell contract', () => {
    const docs = fixtureDocsForConnector('mn-incumbents', incumbentsConnector.meta.url);
    expect(docs.length).toBeGreaterThanOrEqual(1);
    const all = docs.flatMap((d) => incumbentsConnector.parse(d) as Extraction[]);
    const awards = byKind(all, 'signal').filter((s) => (s.fields as { signalType: string }).signalType === 'award_history');
    expect(awards.length).toBeGreaterThanOrEqual(1);
    expect(awards.some((s) => /Caterpillar|BOMAG|Alamo|Henderson/.test((s.fields as { detail: string }).detail))).toBe(true);
    expect((awards[0]!.fields as { title: string }).title).toMatch(/^Incumbents —/);
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
