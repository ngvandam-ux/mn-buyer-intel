/**
 * Focus lenses — a configurable ranking tilt over categories. The default `products_tech`
 * lens boosts technology/product categories and demotes construction/services, so the same
 * data can be viewed through a "sell products & tech" lens without dropping anything.
 *
 * A lens is applied as a multiplier on a match/opportunity's score (re-ranking), keyed by
 * the category the record belongs to. It does NOT change which records exist or their
 * explainable factors — it's a view, toggleable in the UI.
 */

export interface FocusLens {
  name: string;
  label: string;
  /** Multiplier for categories not explicitly weighted. */
  default: number;
  weights: Record<string, number>;
}

export const FOCUS_LENSES: Record<string, FocusLens> = {
  products_tech: {
    name: 'products_tech',
    label: 'Products & Technology',
    default: 0.85,
    weights: {
      telecom: 1.5,
      software: 1.5,
      cybersecurity: 1.5,
      it_hardware: 1.45,
      security_services: 1.3,
      safety: 1.3,
      fleet: 1.1,
      medical: 1.05,
      utilities_energy: 1.0,
      transportation_transit: 1.0,
      professional_services: 0.8,
      food_services: 0.6,
      facilities: 0.55,
      construction: 0.45,
      janitorial_supplies: 0.4,
    },
  },
  none: { name: 'none', label: 'No focus (neutral)', default: 1, weights: {} },
};

export const DEFAULT_FOCUS = 'products_tech';

export function getLens(name: string | undefined): FocusLens {
  return FOCUS_LENSES[name ?? DEFAULT_FOCUS] ?? FOCUS_LENSES.none!;
}

/**
 * The lens multiplier for a record, driven by its best (most-boosted) category. Records
 * with no categories get the lens default; the neutral lens always returns 1.
 */
export function lensWeightForCategories(lensName: string | undefined, categoryKeys: string[]): number {
  const lens = getLens(lensName);
  if (lens.name === 'none') return 1;
  if (categoryKeys.length === 0) return lens.default;
  return Math.max(...categoryKeys.map((k) => lens.weights[k] ?? lens.default));
}
