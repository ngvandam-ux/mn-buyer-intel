/**
 * Buyer lookalikes — cosine similarity over category-exposure vectors. Deterministic, no ML.
 * Two buyers are similar when they buy/fund the same categories. (The reserved `embedding`
 * column is a future semantic upgrade; this is the v1 deterministic version.)
 */

/** Cosine similarity of two sparse weight maps, 0..1. */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  for (const v of b.values()) nb += v * v;
  return na > 0 && nb > 0 ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Categories two weight maps share, strongest-combined first. */
export function sharedKeys(a: Map<string, number>, b: Map<string, number>): string[] {
  const shared: Array<{ k: string; w: number }> = [];
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv) shared.push({ k, w: v + bv });
  }
  return shared.sort((x, y) => y.w - x.w).map((s) => s.k);
}
