/**
 * Sourcewell — a Minnesota-based cooperative purchasing organization. Its public
 * solicitations page lists competitive RFPs grouped under Open / Pending / Recently
 * awarded headings. Each solicitation is an `<a href="/solicitations/{id}">` whose text
 * is the title; status is inferred from the section heading it falls under.
 *
 * A cooperative contract is a buying *pathway*: any MN public entity can purchase from an
 * awarded Sourcewell contract without running its own bid — so we also emit a
 * `cooperative_pathway` signal for the Sourcewell entity.
 */

import type { Extraction, FetchContext, OpportunityStatus, RawDocument, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';

const BASE = 'https://www.sourcewell-mn.gov';
const URL = `${BASE}/solicitations`;
const ENTITY = 'Sourcewell';

function statusFromHeading(text: string): OpportunityStatus | null {
  const t = text.toLowerCase();
  if (t === 'open' || t.startsWith('open')) return 'open';
  if (t.startsWith('pending')) return 'upcoming';
  if (t.includes('award')) return 'awarded';
  return null;
}

export const sourcewellConnector: SourceConnector = {
  meta: {
    id: 'mn-sourcewell',
    sourceName: 'Sourcewell Solicitations',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'cooperative_purchasing',
    fetchMode: 'static',
    description: 'Cooperative purchasing RFPs (open/pending/awarded) usable by MN public agencies.',
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
        { name: ENTITY, entityType: 'cooperative_purchasing', jurisdiction: 'MN', website: BASE },
        [evidenceSpan('title', 'Sourcewell', at)],
        { confidence: 0.95 },
      ),
    );
    out.push(
      extract.signal(
        {
          signalType: 'cooperative_pathway',
          title: 'Sourcewell cooperative contracts available to MN public agencies',
          detail:
            'Awarded Sourcewell contracts can be used by Minnesota public entities without a separate competitive bid.',
          url: URL,
          entityName: ENTITY,
          entityType: 'cooperative_purchasing',
        },
        [evidenceSpan('h2', 'Competitive solicitations for Sourcewell', at)],
      ),
    );

    let status: OpportunityStatus = 'open';
    const seen = new Set<string>();
    $('h2, a[href*="/solicitations/"]').each((_i, el) => {
      const $el = $(el);
      if ((el as Element).tagName === 'h2') {
        const s = statusFromHeading($el.text().replace(/\s+/g, ' ').trim());
        if (s) status = s;
        return;
      }
      const href = $el.attr('href') ?? '';
      const m = href.match(/\/solicitations\/(\d+)/);
      if (!m) return;
      const externalId = m[1]!;
      const title = $el.text().replace(/\s+/g, ' ').trim();
      if (!title || seen.has(externalId)) return;
      seen.add(externalId);
      const url = href.startsWith('http') ? href : `${BASE}${href}`;
      out.push(
        extract.opportunity(
          {
            externalId,
            title,
            status,
            entityName: ENTITY,
            entityType: 'cooperative_purchasing',
            solicitationType: 'Cooperative RFP',
            url,
          },
          [evidenceSpan(`a[href="${href}"]`, title, at)],
          { confidence: 0.9 },
        ),
      );
    });

    return out;
  },
};
