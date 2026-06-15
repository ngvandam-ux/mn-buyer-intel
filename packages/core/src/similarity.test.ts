import { describe, expect, it } from 'vitest';
import { cosineSimilarity, sharedKeys } from './similarity.js';

const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity(m({ software: 1, cyber: 1 }), m({ software: 1, cyber: 1 }))).toBeCloseTo(1, 5);
  });
  it('is 0 for disjoint vectors', () => {
    expect(cosineSimilarity(m({ software: 1 }), m({ fleet: 1 }))).toBe(0);
  });
  it('is between 0 and 1 for partial overlap', () => {
    const s = cosineSimilarity(m({ software: 2, cyber: 1 }), m({ software: 1, fleet: 1 }));
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it('is 0 when either is empty', () => {
    expect(cosineSimilarity(new Map(), m({ x: 1 }))).toBe(0);
  });
});

describe('sharedKeys', () => {
  it('returns shared keys sorted by combined weight', () => {
    expect(sharedKeys(m({ a: 1, b: 3 }), m({ a: 1, b: 1, c: 9 }))).toEqual(['b', 'a']);
  });
});
