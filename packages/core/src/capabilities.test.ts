import { describe, expect, it } from 'vitest';
import { detectCapabilities } from './capabilities.js';

describe('detectCapabilities', () => {
  it('finds named tech capabilities in budget-style text', () => {
    const t =
      'Investment in the Microsoft Enterprise Agreement with more security and AI capabilities; CloudRAMP enables Azure migration; MNEIAM provides identity and access management; cybersecurity endpoint protection.';
    const keys = detectCapabilities(t).map((c) => c.key);
    expect(keys).toContain('cloud');
    expect(keys).toContain('iam');
    expect(keys).toContain('ms_license');
    expect(keys).toContain('ai');
    expect(keys).toContain('cyber');
  });

  it('tags categories + returns evidence snippets', () => {
    const caps = detectCapabilities('Funding for body-worn camera and records management system rollout');
    expect(caps.find((c) => c.key === 'public_safety_tech')?.category).toBe('safety');
    expect(caps[0]!.snippet.length).toBeGreaterThan(0);
  });

  it('returns nothing when no capability is mentioned', () => {
    expect(detectCapabilities('the meeting is at noon')).toEqual([]);
  });
});
