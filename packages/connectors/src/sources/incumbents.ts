/**
 * Incumbent intelligence — who currently holds the contract (the vendors a seller would be
 * displacing). Sourcewell awarded cooperative contracts list their awarded suppliers on each
 * solicitation's detail page ("Awarded Contracts: <Vendor> <contract#> …"), rendered by JS.
 *
 * We fetch the awarded solicitations from the listing, render each detail, and emit one
 * `award_history` signal per contract naming the incumbents — category-tagged, evidence-cited.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { collapseWhitespace, evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';

const BASE = 'https://www.sourcewell-mn.gov';
const LISTING = `${BASE}/solicitations`;
const ENTITY = 'Sourcewell';
const MAX_CONTRACTS = 12;

/** Awarded solicitation ids from the listing page (under the "Recently awarded" heading). */
function awardedIds(html: string): string[] {
  const $ = cheerio.load(html);
  let section = '';
  const ids: string[] = [];
  $('h2, a[href*="/solicitations/"]').each((_i, el) => {
    if ((el as Element).tagName === 'h2') {
      section = $(el).text().toLowerCase();
      return;
    }
    const m = ($(el).attr('href') ?? '').match(/solicitations\/(\d+)/);
    if (m?.[1] && section.includes('award') && !ids.includes(m[1])) ids.push(m[1]);
  });
  return ids;
}

const CONTRACT_NUM = /\s*\d{6}-[A-Z0-9]{2,6}\s*/;

/** Parse the awarded supplier names from a rendered detail page. */
function parseIncumbents(html: string): { title: string; vendors: string[] } {
  const $ = cheerio.load(html);
  const title =
    ($('title').text().split('|')[0] ?? '').replace(/\s+/g, ' ').trim() ||
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    'Sourcewell contract';
  const body = $('body').text().replace(/\s+/g, ' ');
  const m = body.match(/Awarded Contracts/i);
  if (!m || m.index === undefined) return { title, vendors: [] };
  // Region starts AFTER the heading; vendors are the chunks between contract numbers
  // (formats vary: "<Vendor> <num> <Vendor> <num>" or comma-separated lists).
  const region = body.slice(m.index + 'Awarded Contracts'.length, m.index + 4000);
  const segments = region.split(new RegExp(CONTRACT_NUM, 'g'));
  const vendors: string[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    for (const raw of seg.split(/[,;]/)) {
      const v = raw.replace(/^[\s,;]+|[\s,;]+$/g, '').trim();
      if (!v || seen.has(v)) continue;
      const words = v.split(/\s+/);
      // A company name: starts uppercase, short, not prose.
      if (
        /^[A-Z0-9]/.test(v) &&
        v.length <= 48 &&
        words.length <= 6 &&
        !/\b(the|and|for|with|are|will|that|this|contract|supplier|awarded|view|learn)\b/i.test(v)
      ) {
        seen.add(v);
        vendors.push(v);
        if (vendors.length >= 40) return { title, vendors };
      }
    }
  }
  return { title, vendors };
}

export const incumbentsConnector: SourceConnector = {
  meta: {
    id: 'mn-incumbents',
    sourceName: 'Incumbent Contract Holders (Sourcewell)',
    url: LISTING,
    jurisdiction: 'MN',
    entityHint: 'cooperative_purchasing',
    fetchMode: 'browser',
    description: 'Awarded cooperative-contract vendors (incumbents to displace) by category.',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-incumbents requires a browser fetcher');
    const listing = await ctx.fetchStatic(LISTING);
    const ids = awardedIds(listing.body).slice(0, MAX_CONTRACTS);
    const docs: RawDocument[] = [];
    for (const id of ids) {
      try {
        docs.push(await ctx.fetchBrowser(`${BASE}/solicitations/${id}`, { settleMs: 4000, timeoutMs: 60_000 }));
      } catch (err) {
        ctx.log(`skip ${id}: ${String(err).slice(0, 80)}`);
      }
    }
    return docs;
  },

  parse(raw: RawDocument): Extraction[] {
    const { title, vendors } = parseIncumbents(raw.body);
    if (vendors.length === 0) return [];
    const at = raw.fetchedAt;
    const shown = vendors.slice(0, 5).join(', ') + (vendors.length > 5 ? ` +${vendors.length - 5} more` : '');
    return [
      extract.entity(
        { name: ENTITY, entityType: 'cooperative_purchasing', jurisdiction: 'MN', website: BASE },
        [evidenceSpan('title', ENTITY, at)],
        { confidence: 0.9 },
      ),
      extract.signal(
        {
          signalType: 'award_history',
          title: `Incumbents — ${title}: ${shown}`,
          detail: `Sourcewell awarded suppliers (${vendors.length}): ${vendors.join(', ')}`,
          url: raw.url,
          entityName: ENTITY,
          entityType: 'cooperative_purchasing',
          observedAt: at,
          strength: 0.6,
        },
        [evidenceSpan('Awarded Contracts', collapseWhitespace(shown), at)],
        { confidence: 0.8 },
      ),
    ];
  },
};
