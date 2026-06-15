/**
 * Title intelligence — infer a procurement contact's seniority, decision-maker status, and
 * the purchasing area they own, from their title + employer. Deterministic + pure, so the
 * "who to call" decision-maker map is derived consistently and is unit-testable.
 *
 * `roleCategory` of `null` means a general procurement lead (owns all categories) — they
 * match any seller. A specific key (e.g. `software`) means a specialized buyer.
 */

/** Seniority 0–100 from a title. Higher = more authority over buys. */
export function inferTitleRank(title: string | null | undefined): number {
  if (!title) return 30;
  const t = title.toLowerCase();
  if (/\bchief\b|\bcpo\b|\bcio\b|commissioner|\bdirector\b(?!\s+of\s+\w)/.test(t)) return 90;
  if (/managing director|deputy|assistant director|associate director/.test(t)) return 80;
  if (/\bdirector\b/.test(t)) return 88;
  if (/\bmanager\b|supervisor|\bchief\b|\blead\b|administrator/.test(t)) return 62;
  if (/officer|coordinator|analyst|\bbuyer\b|specialist|agent/.test(t)) return 45;
  return 35;
}

/** Managers and above sign or strongly influence purchases. */
export function isDecisionMakerTitle(title: string | null | undefined): boolean {
  return inferTitleRank(title) >= 60;
}

/** The purchasing area a person owns, inferred from title + employer. null = general lead. */
export function inferRoleCategory(
  title: string | null | undefined,
  entityName?: string | null,
): string | null {
  const t = `${title ?? ''} ${entityName ?? ''}`.toLowerCase();
  if (/\bit\b|technology|\bcio\b|information services|digital|software|cyber|data/.test(t)) return 'software';
  if (/mmcap|pharmaceutic|\bmedical\b|\bhealth\b|clinical/.test(t)) return 'medical';
  if (/fleet|vehicle|motor pool/.test(t)) return 'fleet';
  if (/construction|capital project|public works|facilit/.test(t)) return 'construction';
  if (/public safety|law enforcement|police|emergency/.test(t)) return 'safety';
  if (/telecom|network|broadband/.test(t)) return 'telecom';
  // General procurement / contracting leaders own everything → null (matches any category).
  return null;
}

export interface TitleIntel {
  titleRank: number;
  isDecisionMaker: boolean;
  roleCategory: string | null;
}

export function titleIntel(title: string | null | undefined, entityName?: string | null): TitleIntel {
  return {
    titleRank: inferTitleRank(title),
    isDecisionMaker: isDecisionMakerTitle(title),
    roleCategory: inferRoleCategory(title, entityName),
  };
}
