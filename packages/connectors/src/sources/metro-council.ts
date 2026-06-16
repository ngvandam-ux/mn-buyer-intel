/**
 * Metropolitan Council (Twin Cities regional transit/planning agency) — current
 * solicitations. The Contracting page renders a static `table-sort` table of open RFPs/IFBs:
 *   Division | Number | Title/General Description | Issue Date | Due Date | Type
 * Each Number links to the solicitation's document page (`/getdoc/<uuid>/Number.aspx`).
 *
 * Each row → one open opportunity, with the Division as the business unit and the Number as
 * the external id. Categories are auto-detected from the title during ingest. Static fetch.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import { extract } from '../extraction.js';
import { parseUsDateTime } from '../runtime/dates.js';

const URL = 'https://metrocouncil.org/Contracting.aspx';
const ORIGIN = 'https://metrocouncil.org';
const ENTITY = 'Metropolitan Council';

const abs = (href: string): string => (href.startsWith('http') ? href : `${ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`);

export const metroCouncilConnector: SourceConnector = {
  meta: {
    id: 'mn-metro-council',
    sourceName: 'Metropolitan Council Opportunities',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'special_district_transit_council',
    fetchMode: 'static',
    description: 'Twin Cities Metropolitan Council current solicitations (RFP/IFB) with division, dates, and type.',
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
        { name: ENTITY, entityType: 'special_district_transit_council', jurisdiction: 'MN', website: ORIGIN },
        [evidenceSpan('h1/h2', 'Requests For Proposals (RFP) and Invitations For Bids (IFB)', at)],
        { confidence: 0.95 },
      ),
    );

    $('table.table-sort tr').each((_, tr) => {
      const $tr = $(tr);
      // Header row has 6 cells; data rows carry a leading hidden sort-date cell (7). Take the
      // trailing 6 so indexing is stable regardless of that hidden cell.
      const cells = $tr
        .find('td')
        .toArray()
        .map((td) => $(td).text().replace(/\s+/g, ' ').trim());
      if (cells.length < 6) return; // header (<th>) or spacer
      const [division, number, title, issue, due, type] = cells.slice(-6);
      if (!number || !title) return;

      const href = $tr.find('a[href*="/getdoc/"]').attr('href') ?? $tr.find('a').attr('href');
      out.push(
        extract.opportunity(
          {
            externalId: number,
            title,
            status: 'open',
            businessUnit: division || null,
            solicitationType: type || null,
            entityName: ENTITY,
            entityType: 'special_district_transit_council',
            postedDate: parseUsDateTime(issue),
            dueDate: parseUsDateTime(due),
            url: href ? abs(href) : URL,
          },
          [evidenceSpan('table.table-sort tr', `${division} ${number} — ${title} (${type}, due ${due})`, at)],
          { confidence: 0.85 },
        ),
      );
    });

    return out;
  },
};
