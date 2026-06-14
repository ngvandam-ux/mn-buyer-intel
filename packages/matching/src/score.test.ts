import { describe, expect, it } from 'vitest';
import {
  type OpportunityScoringInput,
  buildSellerVector,
  scoreOpportunity,
} from './score.js';

const telecomSeller = buildSellerVector({
  companyName: 'NorthFiber LLC',
  capabilities: ['fiber optic installation', 'broadband network construction'],
  services: ['structured cabling'],
  categories: ['telecom'],
  geographies: [],
});

function input(over: Partial<OpportunityScoringInput> = {}): OpportunityScoringInput {
  return {
    opportunity: {
      id: 'opp1',
      title: 'Fiber Optic Network Expansion',
      description: 'Install fiber optic cabling across district facilities',
      status: 'open',
      businessUnit: null,
      solicitationType: 'RFx',
      categoryKeys: ['telecom'],
    },
    entity: { id: 'ent1', name: 'Office of Broadband Development', entityType: 'state_agency', county: null, city: null },
    signals: [{ signalType: 'open_solicitation', strength: 1, title: 'Open solicitation', detail: null }],
    hasNamedContact: true,
    evidenceSpanIds: ['ev1', 'ev2'],
    ...over,
  };
}

describe('buildSellerVector', () => {
  it('detects categories from capability text in addition to explicit ones', () => {
    const v = buildSellerVector({ companyName: 'X', capabilities: ['fiber broadband network'] });
    expect(v.categories.has('telecom')).toBe(true);
  });
  it('tokenizes capabilities/services/products/keywords', () => {
    expect(telecomSeller.tokens.has('fiber')).toBe(true);
    expect(telecomSeller.tokens.has('cabling')).toBe(true);
  });
});

describe('scoreOpportunity — tiers', () => {
  it('HIGH: open solicitation + named contact + matching category', () => {
    const out = scoreOpportunity(telecomSeller, input());
    expect(out.tier).toBe('high');
    expect(out.relevant).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(80);
    const factors = out.reasons.map((r) => r.factor);
    expect(factors).toContain('category');
    expect(factors).toContain('contact_presence');
    expect(factors).toContain('signal_type');
  });

  it('MEDIUM: open + matching category but NO named contact', () => {
    const out = scoreOpportunity(telecomSeller, input({ hasNamedContact: false }));
    expect(out.tier).toBe('medium');
    expect(out.relevant).toBe(true);
  });

  it('MEDIUM: expiring contract + category match (not open, no contact)', () => {
    const out = scoreOpportunity(
      telecomSeller,
      input({
        hasNamedContact: false,
        opportunity: {
          id: 'opp2',
          title: 'Fiber Maintenance Contract',
          description: 'Existing telecom contract',
          status: 'unknown',
          businessUnit: null,
          solicitationType: null,
          categoryKeys: ['telecom'],
        },
        signals: [{ signalType: 'expiring_contract', strength: 0.7, title: 'Contract expiring', detail: null }],
      }),
    );
    expect(out.tier).toBe('medium');
  });

  it('LOW: topical relevance from a published priority signal only', () => {
    const out = scoreOpportunity(
      telecomSeller,
      input({
        hasNamedContact: false,
        opportunity: {
          id: 'opp3',
          title: 'Janitorial Services',
          description: 'Cleaning services for offices',
          status: 'unknown',
          businessUnit: null,
          solicitationType: null,
          categoryKeys: ['janitorial_supplies'],
        },
        signals: [
          {
            signalType: 'policy_priority',
            strength: 0.4,
            title: 'Statewide broadband expansion priority',
            detail: 'Fiber to every community is a state goal',
          },
        ],
      }),
    );
    expect(out.relevant).toBe(true);
    expect(out.tier).toBe('low');
    expect(out.reasons.map((r) => r.factor)).toContain('priority_language');
  });

  it('NOT RELEVANT: an open solicitation with a contact but no topical overlap is not a match', () => {
    const out = scoreOpportunity(
      telecomSeller,
      input({
        opportunity: {
          id: 'opp4',
          title: 'Janitorial Services',
          description: 'Cleaning services',
          status: 'open',
          businessUnit: null,
          solicitationType: null,
          categoryKeys: ['janitorial_supplies'],
        },
        signals: [{ signalType: 'open_solicitation', strength: 1, title: 'Open', detail: null }],
      }),
    );
    expect(out.relevant).toBe(false);
  });
});

describe('scoreOpportunity — explainability', () => {
  it('every reason carries a contribution and threads opportunity evidence span ids', () => {
    const out = scoreOpportunity(telecomSeller, input());
    expect(out.reasons.length).toBeGreaterThan(0);
    const category = out.reasons.find((r) => r.factor === 'category');
    expect(category).toBeDefined();
    expect(category!.contribution).toBeGreaterThan(0);
    expect(category!.reason).toMatch(/Telecom/i);
    expect(category!.evidenceSpanIds).toEqual(['ev1', 'ev2']);
  });

  it('score equals the sum of reason contributions (rounded)', () => {
    const out = scoreOpportunity(telecomSeller, input());
    const sum = Math.round(out.reasons.reduce((s, r) => s + r.contribution, 0));
    expect(out.score).toBe(sum);
  });
});
