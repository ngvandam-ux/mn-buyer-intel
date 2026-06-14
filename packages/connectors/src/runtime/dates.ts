/** US date/time parsing for source strings → ISO-8601 (UTC). Returns null if unparseable. */

const TZ_OFFSET: Record<string, string> = {
  CDT: '-05:00',
  CST: '-06:00',
  EDT: '-04:00',
  EST: '-05:00',
  MDT: '-06:00',
  MST: '-07:00',
  PDT: '-07:00',
  PST: '-08:00',
  UTC: '+00:00',
  GMT: '+00:00',
};

/**
 * Parse strings like:
 *   "06/15/2026 10:00 AM CDT"
 *   "06/15/2026 03:00 PM"
 *   "06/15/2026"
 * Unzoned values default to US Central (the jurisdiction's timezone).
 */
export function parseUsDateTime(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input
    .trim()
    .match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T]+(\d{1,2}):(\d{2})\s*(AM|PM)?)?(?:\s+([A-Z]{2,4}))?/i);
  if (!m) return null;
  const mm = m[1]!;
  const dd = m[2]!;
  const yyyy = m[3]!;
  let hour = m[4] ? Number.parseInt(m[4], 10) : 0;
  const minute = m[5] ? Number.parseInt(m[5], 10) : 0;
  const ap = m[6]?.toUpperCase();
  const tz = m[7]?.toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  const offset = (tz && TZ_OFFSET[tz]) || '-06:00';
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${offset}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Parse a fixture filename timestamp like `20260614T041018Z` → ISO. */
export function parseFixtureTimestamp(name: string): string | null {
  const m = name.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
