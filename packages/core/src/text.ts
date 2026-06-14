/**
 * Pure text utilities. Browser-safe (no Node builtins) so the web app can import them.
 * Used by category tagging, signal detection, and the match scorer.
 */

const STOPWORDS = new Set([
  'a','an','and','the','or','of','to','in','for','on','with','by','at','from','as','is',
  'are','be','this','that','these','those','it','its','will','shall','may','must','can',
  'we','you','our','your','their','they','he','she','i','was','were','has','have','had',
  'not','no','if','then','else','than','so','such','any','all','each','per','via','into',
  'out','up','down','over','under','about','between','through','during','before','after',
  'rfp','rfq','rfi','bid','solicitation','proposal','request','services','service',
]);

/**
 * Conservative singularizer for keyword matching recall (platforms→platform,
 * cameras→camera, facilities→facility). Leaves short words and "-ss" words alone.
 */
export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('ss')) return word;
  // Don't strip a trailing 's' off words that are not plurals (analysis, status, virus).
  if (/(?:is|us)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse internal whitespace and trim; preserves case + punctuation. */
export function collapseWhitespace(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Tokenize into a deduped set of meaningful word tokens (>= 3 chars, not a stopword).
 * Multi-word phrases are not produced here; use {@link phraseHits} for phrase matching.
 */
export function tokenize(input: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const tok of normalizeText(input).split(' ')) {
    if (tok.length >= 3 && !STOPWORDS.has(tok)) out.add(singularize(tok));
  }
  return out;
}

/** Tokenize many strings into one combined token set. */
export function tokenizeAll(inputs: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const s of inputs) for (const t of tokenize(s)) out.add(t);
  return out;
}

/**
 * Return the keywords from `needles` that appear in `haystack`.
 * A single-word needle matches a whole token; a multi-word needle matches as a
 * normalized substring. Case/punctuation-insensitive.
 */
export function phraseHits(haystack: string | null | undefined, needles: string[]): string[] {
  const normHay = normalizeText(haystack);
  if (!normHay) return [];
  const hayTokens = new Set(normHay.split(' ').map(singularize));
  const hits: string[] = [];
  for (const raw of needles) {
    const needle = normalizeText(raw);
    if (!needle) continue;
    if (needle.includes(' ')) {
      if (normHay.includes(needle)) hits.push(raw);
    } else if (hayTokens.has(singularize(needle))) {
      hits.push(raw);
    }
  }
  return hits;
}

/** Count of shared tokens between two token sets. */
export function overlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) n += 1;
  return n;
}

/** Jaccard similarity of two token sets, 0..1. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = overlapCount(a, b);
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Truncate to `max` chars with an ellipsis, on a word boundary where possible. */
export function snippet(input: string | null | undefined, max = 240): string {
  const s = collapseWhitespace(input);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
