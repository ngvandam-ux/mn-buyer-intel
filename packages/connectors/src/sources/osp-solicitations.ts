/**
 * Minnesota Office of State Procurement (OSP) — Solicitations & Contract Opportunities.
 *
 * This page is a navigation hub rather than a listing (the live bids live in the Supplier
 * Portal connector). Its value is the section structure, which maps cleanly onto signals:
 *   - "Contracts Expiring in 7 Months" → expiring_contract
 *   - "TG/ED/VO Opportunities"         → policy_priority (supplier-diversity preference)
 *   - "Construction Virtual Plan Room" → strategic_initiative (construction bid pathway)
 *   - "Supplier Portal"                → cooperative_pathway (where to find live bids)
 *
 * The page is behind a Radware bot wall, so it needs the browser fetcher.
 */

import type { Extraction, FetchContext, RawDocument, SignalType, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';
import { looksLikeBotWall } from '../runtime/bot-wall.js';

const URL = 'https://mn.gov/admin/osp/vendors/solicitations-and-contract-opportunities/';
const ENTITY = 'Minnesota Office of State Procurement';

interface SectionSignal {
  heading: RegExp;
  signalType: SignalType;
  title: string;
  detail: string;
}

const SECTION_SIGNALS: SectionSignal[] = [
  {
    heading: /Contracts Expiring/i,
    signalType: 'expiring_contract',
    title: 'State contracts expiring within 7 months',
    detail: 'OSP publishes a list of enterprise contracts expiring in the next 7 months — re-bid opportunities ahead.',
  },
  {
    heading: /TG\/ED\/VO|Targeted Group/i,
    signalType: 'policy_priority',
    title: 'Targeted Group / Economically Disadvantaged / Veteran-Owned preferences',
    detail: 'OSP applies procurement preferences for TG, ED, and Veteran-Owned businesses.',
  },
  {
    heading: /Construction Virtual Plan Room/i,
    signalType: 'strategic_initiative',
    title: 'Construction Virtual Plan Room',
    detail: 'Construction bid documents are published through the OSP Construction Virtual Plan Room.',
  },
  {
    heading: /Supplier Portal/i,
    signalType: 'cooperative_pathway',
    title: 'Live solicitations posted on the Supplier Portal',
    detail: 'Active state solicitations are posted and bid through the Minnesota Supplier Portal.',
  },
];

export const ospSolicitationsConnector: SourceConnector = {
  meta: {
    id: 'mn-osp-solicitations',
    sourceName: 'OSP Solicitations & Contract Opportunities',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'browser',
    description: 'OSP procurement hub: expiring contracts, diversity preferences, posting pathways.',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-osp-solicitations requires a browser fetcher');
    let doc = await ctx.fetchBrowser(URL, { settleMs: 3000, timeoutMs: 60_000 });
    if (looksLikeBotWall(doc.body)) {
      ctx.log('bot wall hit, retrying once');
      doc = await ctx.fetchBrowser(URL, { settleMs: 6000, timeoutMs: 60_000 });
    }
    return [doc];
  },

  parse(raw: RawDocument): Extraction[] {
    const $ = cheerio.load(raw.body);
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    out.push(
      extract.entity(
        { name: ENTITY, entityType: 'state_agency', jurisdiction: 'MN', website: 'https://mn.gov/admin/osp/' },
        [evidenceSpan('h1', 'Solicitations and Contract Opportunities', at)],
        { confidence: 0.95 },
      ),
    );

    const headings = $('h1, h2, h3').toArray();
    for (const sig of SECTION_SIGNALS) {
      const match = headings.find((h) => sig.heading.test($(h).text()));
      if (!match) continue;
      const headingText = $(match).text().replace(/\s+/g, ' ').trim();
      out.push(
        extract.signal(
          {
            signalType: sig.signalType,
            title: sig.title,
            detail: sig.detail,
            url: URL,
            entityName: ENTITY,
            entityType: 'state_agency',
            observedAt: at,
          },
          [evidenceSpan(`${(match as Element).tagName}:contains`, headingText, at)],
          { confidence: 0.8 },
        ),
      );
    }

    return out;
  },
};
