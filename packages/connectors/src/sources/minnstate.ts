/**
 * Minnesota State (the 33-college/university system) — procurement. The public page
 * exposes the procurement office, a few named staff emails, and cooperative-purchasing /
 * policy guidance. Opportunities themselves run through JAGGAER (login-gated), so this
 * connector contributes the entity, office, contacts, and buying-pathway signals.
 */

import type { Extraction, FetchContext, RawDocument, SignalType, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';

const URL = 'https://www.minnstate.edu/system/finance/procurement/index.html';
const ENTITY = 'Minnesota State';
const OFFICE = 'Minnesota State System Procurement';

function nameFromEmail(email: string): string | null {
  const local = email.split('@')[0] ?? '';
  const parts = local.split('.').filter((p) => /^[a-z]+$/i.test(p));
  if (parts.length < 2) return null;
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

const SECTION_SIGNALS: Array<{ heading: RegExp; type: SignalType; title: string; detail: string }> = [
  {
    heading: /Cooperative Contract/i,
    type: 'cooperative_pathway',
    title: 'Minnesota State cooperative contract guidelines',
    detail: 'Minnesota State publishes cooperative-contract guidance for system purchasing.',
  },
  {
    heading: /Competitive Bidding|Compliance/i,
    type: 'policy_priority',
    title: 'Minnesota State competitive bidding & compliance policy',
    detail: 'System-wide competitive bidding and compliance requirements govern purchases.',
  },
  {
    heading: /JAGGAER|e-Procurement|Marketplace/i,
    type: 'strategic_initiative',
    title: 'Minnesota State e-Procurement (JAGGAER Marketplace)',
    detail: 'Purchasing flows through the JAGGAER e-procurement marketplace.',
  },
];

export const minnstateConnector: SourceConnector = {
  meta: {
    id: 'mn-minnstate',
    sourceName: 'Minnesota State Procurement',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'higher_education',
    fetchMode: 'static',
    description: 'Minnesota State system procurement office, contacts, and cooperative pathways.',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    return [await ctx.fetchStatic(URL)];
  },

  parse(raw: RawDocument): Extraction[] {
    const $ = cheerio.load(raw.body);
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    out.push(
      extract.entity(
        { name: ENTITY, entityType: 'higher_education', jurisdiction: 'MN', website: 'https://www.minnstate.edu' },
        [evidenceSpan('h1', 'Procurement', at)],
        { confidence: 0.9 },
      ),
    );
    out.push(
      extract.office(
        { name: OFFICE, entityName: ENTITY, entityType: 'higher_education', url: URL },
        [evidenceSpan('h1', 'Procurement', at)],
        { confidence: 0.85 },
      ),
    );

    const seen = new Set<string>();
    $('a[href^="mailto:"]').each((_i, el) => {
      const email = ($(el).attr('href') ?? '').replace(/^mailto:/i, '').trim();
      const name = nameFromEmail(email);
      if (!name || seen.has(email)) return;
      seen.add(email);
      out.push(
        extract.contact(
          { name, email, entityName: ENTITY, entityType: 'higher_education', officeName: OFFICE },
          [evidenceSpan(`a[href="mailto:${email}"]`, email, at)],
          { confidence: 0.6, partial: true },
        ),
      );
    });

    const headings = $('h1, h2, h3, h4').toArray();
    const usedTypes = new Set<SignalType>();
    for (const sig of SECTION_SIGNALS) {
      if (usedTypes.has(sig.type)) continue;
      const match = headings.find((h) => sig.heading.test($(h).text()));
      if (!match) continue;
      usedTypes.add(sig.type);
      out.push(
        extract.signal(
          {
            signalType: sig.type,
            title: sig.title,
            detail: sig.detail,
            url: URL,
            entityName: ENTITY,
            entityType: 'higher_education',
            observedAt: at,
          },
          [evidenceSpan(`${(match as Element).tagName}`, $(match).text().replace(/\s+/g, ' ').trim(), at)],
          { confidence: 0.75 },
        ),
      );
    }

    return out;
  },
};
