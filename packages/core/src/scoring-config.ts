/**
 * Match-scoring configuration. The engine lives in `@mn/matching`; the tunable numbers
 * live here so they are shared and unit-testable in isolation.
 *
 * The numeric `score` (0..100) is a weighted sum of factor contributions. The `tier`
 * (high/medium/low) is decided by explicit rules over which conditions are present —
 * not by thresholding the score — exactly as specified:
 *
 *   high   = open solicitation + named contact + matching category
 *   medium = expiring contract or repeated history + matching entity/office
 *   low    = strategic / budget / article signal only
 */

import type { ScoreFactorKey } from './taxonomy.js';

export type ScoreWeights = Record<ScoreFactorKey, number>;

/** Max points each factor can contribute. Sum is 100. */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  category: 26,
  opportunity_text: 20,
  signal_type: 16,
  budget_fit: 12,
  office_name: 8,
  priority_language: 7,
  contact_presence: 6,
  geography: 5,
};

export const SCORE_WEIGHTS_TOTAL = Object.values(DEFAULT_SCORE_WEIGHTS).reduce(
  (a, b) => a + b,
  0,
);
