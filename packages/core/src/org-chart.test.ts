import { describe, expect, it } from 'vitest';
import { inferRoleCategory, inferTitleRank, isDecisionMakerTitle, titleIntel } from './org-chart.js';

describe('title intelligence', () => {
  it('ranks chiefs/directors highest, buyers lowest', () => {
    expect(inferTitleRank('Chief Procurement Officer and Director')).toBeGreaterThanOrEqual(85);
    expect(inferTitleRank('Chief Information Officer')).toBeGreaterThanOrEqual(85);
    expect(inferTitleRank('Acquisitions Manager')).toBeGreaterThanOrEqual(60);
    expect(inferTitleRank('Buyer')).toBeLessThan(60);
    expect(inferTitleRank(null)).toBe(30);
  });

  it('flags decision-makers (manager and above)', () => {
    expect(isDecisionMakerTitle('Chief Information Officer')).toBe(true);
    expect(isDecisionMakerTitle('Contracts Administrator')).toBe(true);
    expect(isDecisionMakerTitle('Procurement Analyst')).toBe(false);
  });

  it('infers the purchasing area from title + employer (null = general lead)', () => {
    expect(inferRoleCategory('CIO', 'Minnesota IT Services')).toBe('software');
    expect(inferRoleCategory('Managing Director, MMCAP Infuse')).toBe('medical');
    expect(inferRoleCategory('Fleet Manager')).toBe('fleet');
    expect(inferRoleCategory('Chief Procurement Officer')).toBeNull();
  });

  it('titleIntel bundles all three', () => {
    const x = titleIntel('Chief Procurement Officer and Director', 'Minnesota Office of State Procurement');
    expect(x.isDecisionMaker).toBe(true);
    expect(x.titleRank).toBeGreaterThanOrEqual(85);
    expect(x.roleCategory).toBeNull();
  });
});
