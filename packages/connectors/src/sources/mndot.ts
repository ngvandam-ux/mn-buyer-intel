/**
 * Minnesota Department of Transportation (MnDOT) — Professional/Technical (P/T) consultant
 * solicitations. MnDOT's highway *construction* lettings live in an AASHTOWare app that
 * renders no parseable list; the P/T Notices page is both reachable and the
 * product/tech-relevant procurement (engineering, planning, IT/ITS, verification services).
 *
 * The page is JavaScript-rendered, so it needs the browser fetcher. Each open notice is an
 * `<h3>` project title followed by a "Brief Description", a "Date posted / Due date" block,
 * and a list of RFP document links. Sections without a posted/due block (program notices,
 * "None at this time") are skipped. One open notice → one opportunity.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { collapseWhitespace, evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import { extract } from '../extraction.js';
import { parseUsDateTime } from '../runtime/dates.js';

const URL = 'https://www.dot.state.mn.us/consult/notices.html';
const ENTITY = 'Minnesota Department of Transportation';

function solicitationType(text: string): string | null {
  if (/quick call/i.test(text)) return 'Quick Call';
  if (/RFP[\s-]?QBS/i.test(text)) return 'RFP-QBS';
  if (/\bRFP\b/i.test(text)) return 'RFP';
  if (/announcement/i.test(text)) return 'Announcement';
  return null;
}

export const mndotConnector: SourceConnector = {
  meta: {
    id: 'mn-mndot',
    sourceName: 'MnDOT Procurement',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'browser',
    description: 'MnDOT Professional/Technical consultant solicitations (engineering, planning, IT/ITS) with posted/due dates.',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-mndot requires a browser fetcher');
    return [await ctx.fetchBrowser(URL, { settleMs: 5000, timeoutMs: 60_000 })];
  },

  parse(raw: RawDocument): Extraction[] {
    const $ = cheerio.load(raw.body);
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    out.push(
      extract.entity(
        { name: ENTITY, entityType: 'state_agency', jurisdiction: 'MN', website: 'https://www.dot.state.mn.us/' },
        [evidenceSpan('h1/h2', 'Professional Technical Consultant Services', at)],
        { confidence: 0.95 },
      ),
    );

    $('h3').each((_, h) => {
      const title = collapseWhitespace($(h).text());
      if (!title || title.length < 4) return;

      // Everything from this title up to the next h3 is the notice's block.
      const $block = $(h).nextUntil('h3');
      const blockText = collapseWhitespace($block.text());
      const dates = blockText.match(/Date posted:\s*([\d/]+)[\s\S]*?Due date:\s*([\d/]+)/i);
      if (!dates) return; // program/info section, not an open solicitation

      const description = blockText.match(/Brief Description:\s*(.+?)\s*Date posted/i)?.[1]?.trim() ?? null;
      const href = $block.find('a[href*="edocs"]').first().attr('href') ?? null;

      out.push(
        extract.opportunity(
          {
            title,
            description: description ? description.slice(0, 800) : null,
            status: 'open',
            businessUnit: 'Professional/Technical Services',
            solicitationType: solicitationType(blockText),
            entityName: ENTITY,
            entityType: 'state_agency',
            postedDate: parseUsDateTime(dates[1]),
            dueDate: parseUsDateTime(dates[2]),
            url: href ?? URL,
          },
          [evidenceSpan('h3 + notice block', `${title} — posted ${dates[1]}, due ${dates[2]}`, at)],
          { confidence: 0.8 },
        ),
      );
    });

    return out;
  },
};
