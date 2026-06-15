import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS, lensWeightForCategories } from './focus.js';

describe('focus lens', () => {
  it('boosts tech and demotes construction under products_tech', () => {
    expect(lensWeightForCategories('products_tech', ['software'])).toBeGreaterThan(1);
    expect(lensWeightForCategories('products_tech', ['cybersecurity'])).toBeGreaterThan(1);
    expect(lensWeightForCategories('products_tech', ['construction'])).toBeLessThan(1);
    expect(lensWeightForCategories('products_tech', ['janitorial_supplies'])).toBeLessThan(1);
  });

  it('uses the best (most-boosted) category', () => {
    expect(lensWeightForCategories('products_tech', ['construction', 'software'])).toBe(
      lensWeightForCategories('products_tech', ['software']),
    );
  });

  it('untagged records get the lens default (< 1, demoted)', () => {
    expect(lensWeightForCategories('products_tech', [])).toBeLessThan(1);
  });

  it('neutral lens is always 1', () => {
    expect(lensWeightForCategories('none', ['construction'])).toBe(1);
    expect(lensWeightForCategories('none', [])).toBe(1);
  });

  it('default focus is products_tech', () => {
    expect(DEFAULT_FOCUS).toBe('products_tech');
  });
});
