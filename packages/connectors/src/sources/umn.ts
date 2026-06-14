/**
 * University of Minnesota — Purchasing Services / suppliers. Bid opportunities run through
 * MBid (login-gated), so the public page yields the entity, the purchasing office, and the
 * vendor-registration pathway (a contact-exposure / cooperative-pathway signal).
 */

import type { Extraction, FetchContext, RawDocument, SignalType, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';

const URL = 'https://purchasing.umn.edu/suppliers';
const ENTITY = 'University of Minnesota';
const OFFICE = 'Purchasing Services';

const SECTION_SIGNALS: Array<{ heading: RegExp; type: SignalType; title: string; detail: string }> = [
  {
    heading: /MBid|Bid Opportunities|Sign Up to View/i,
    type: 'cooperative_pathway',
    title: 'Register for U of M bid opportunities (MBid)',
    detail: 'Suppliers register in MBid to view and respond to University of Minnesota bid opportunities.',
  },
  {
    heading: /Supplier Diversity|Targeted Business|Sustainab/i,
    type: 'policy_priority',
    title: 'U of M supplier diversity & sustainability priority',
    detail: 'The University prioritizes small/targeted business participation and sustainability.',
  },
];

export const umnConnector: SourceConnector = {
  meta: {
    id: 'mn-umn',
    sourceName: 'University of Minnesota Suppliers',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'higher_education',
    fetchMode: 'static',
    description: 'U of M Purchasing Services, vendor registration pathway, and diversity priorities.',
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
        { name: ENTITY, entityType: 'higher_education', jurisdiction: 'MN', website: 'https://purchasing.umn.edu' },
        [evidenceSpan('h1', 'Doing Business with the University of Minnesota', at)],
        { confidence: 0.9 },
      ),
    );
    out.push(
      extract.office(
        { name: OFFICE, entityName: ENTITY, entityType: 'higher_education', url: URL },
        [evidenceSpan('title', 'Purchasing Services', at)],
        { confidence: 0.85 },
      ),
    );

    const headings = $('h1, h2, h3, h4').toArray();
    const used = new Set<SignalType>();
    for (const sig of SECTION_SIGNALS) {
      if (used.has(sig.type)) continue;
      const match = headings.find((h) => sig.heading.test($(h).text()));
      if (!match) continue;
      used.add(sig.type);
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
