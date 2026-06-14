import { describe, expect, it } from 'vitest';
import {
  clamp,
  collapseWhitespace,
  jaccard,
  normalizeText,
  overlapCount,
  phraseHits,
  snippet,
  tokenize,
  tokenizeAll,
} from './text.js';

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeText('Fiber-Optic   CABLING, Inc.')).toBe('fiber optic cabling inc');
  });
  it('handles null/undefined/empty', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('   ')).toBe('');
  });
});

describe('collapseWhitespace', () => {
  it('preserves case + punctuation, collapses spacing', () => {
    expect(collapseWhitespace('  Hello,\n\t World!  ')).toBe('Hello, World!');
  });
});

describe('tokenize', () => {
  it('drops stopwords and short tokens, dedupes', () => {
    const t = tokenize('The fiber and the fiber for a network');
    expect([...t].sort()).toEqual(['fiber', 'network']);
  });
  it('drops procurement noise words (rfp/bid/solicitation)', () => {
    expect([...tokenize('RFP for body cameras')].sort()).toEqual(['body', 'cameras']);
  });
});

describe('tokenizeAll', () => {
  it('unions tokens across inputs', () => {
    const t = tokenizeAll(['fiber network', 'wireless network', null]);
    expect([...t].sort()).toEqual(['fiber', 'network', 'wireless']);
  });
});

describe('phraseHits', () => {
  it('matches single-word needles as whole tokens', () => {
    expect(phraseHits('We need fiber cabling', ['fiber', 'fibers'])).toEqual(['fiber']);
  });
  it('matches multi-word needles as substrings', () => {
    expect(phraseHits('structured cabling project', ['structured cabling', 'voip'])).toEqual([
      'structured cabling',
    ]);
  });
  it('is punctuation/case insensitive', () => {
    expect(phraseHits('Body-Worn Camera RFP', ['body worn camera'])).toEqual(['body worn camera']);
  });
  it('does not match a single-word needle as a partial substring', () => {
    // "net" should not match inside "network"
    expect(phraseHits('network upgrade', ['net'])).toEqual([]);
  });
});

describe('overlapCount + jaccard', () => {
  it('counts shared tokens', () => {
    expect(overlapCount(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(2);
  });
  it('computes jaccard', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3, 5);
  });
  it('jaccard of two empty sets is 0', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('clamp', () => {
  it('clamps into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('snippet', () => {
  it('returns short strings unchanged', () => {
    expect(snippet('short', 240)).toBe('short');
  });
  it('truncates with an ellipsis', () => {
    const s = snippet('a'.repeat(300), 50);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(51);
  });
});
