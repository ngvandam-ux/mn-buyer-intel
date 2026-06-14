import { describe, expect, it } from 'vitest';
import { looksLikeBotWall } from './bot-wall.js';
import { parseFixtureTimestamp, parseUsDateTime } from './dates.js';

describe('parseUsDateTime', () => {
  it('parses a PeopleSoft datetime with CDT zone', () => {
    expect(parseUsDateTime('06/15/2026 10:00 AM CDT')).toBe('2026-06-15T15:00:00.000Z');
  });
  it('parses PM correctly', () => {
    expect(parseUsDateTime('06/15/2026 03:00 PM CDT')).toBe('2026-06-15T20:00:00.000Z');
  });
  it('handles CST offset', () => {
    expect(parseUsDateTime('01/15/2026 09:00 AM CST')).toBe('2026-01-15T15:00:00.000Z');
  });
  it('defaults unzoned dates to US Central', () => {
    // midnight central → 06:00 UTC (CST in January)
    expect(parseUsDateTime('01/15/2026')).toBe('2026-01-15T06:00:00.000Z');
  });
  it('returns null for unparseable input', () => {
    expect(parseUsDateTime('not a date')).toBeNull();
    expect(parseUsDateTime(null)).toBeNull();
    expect(parseUsDateTime('')).toBeNull();
  });
});

describe('parseFixtureTimestamp', () => {
  it('parses a fixture filename timestamp', () => {
    expect(parseFixtureTimestamp('20260614T041018Z.html')).toBe('2026-06-14T04:10:18.000Z');
  });
  it('returns null when no timestamp present', () => {
    expect(parseFixtureTimestamp('latest.html')).toBeNull();
  });
});

describe('looksLikeBotWall', () => {
  it('flags the Radware captcha title', () => {
    expect(looksLikeBotWall('<html><title>Radware Bot Manager Captcha</title>')).toBe(true);
  });
  it('does NOT flag a real page that merely references perfdrive', () => {
    expect(
      looksLikeBotWall('<title>Solicitations</title><script src="//x.perfdrive.com/c.js"></script>'),
    ).toBe(false);
  });
});
