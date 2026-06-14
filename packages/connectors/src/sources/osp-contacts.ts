/**
 * Minnesota OSP contacts. Each procurement contact appears as a `mailto:` link whose
 * surrounding text reads "<Name> <Title> Phone: <phone> Email: <email>". Contacts are
 * grouped under section headings that name the office (Office of State Procurement,
 * Office of Equity in Procurement, MMCAP).
 *
 * Behind a Radware bot wall → browser fetcher.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';
import { looksLikeBotWall } from '../runtime/bot-wall.js';

const URL = 'https://mn.gov/admin/about/contact-us/state-procurement.jsp';
const ENTITY = 'Minnesota Office of State Procurement';

function officeFromHeading(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (/Office of State Procurement Contacts/i.test(t)) return 'Office of State Procurement';
  if (/Office of Equity in Procurement/i.test(t)) return 'Office of Equity in Procurement';
  if (/MMCAP/i.test(t)) return 'MMCAP Infuse';
  return null;
}

/** First+Last from a First.Last(.X) email local part — used to locate the rendered name. */
function nameFromEmail(email: string): string | null {
  const local = email.split('@')[0] ?? '';
  const parts = local.split('.').filter((p) => /^[a-z]+$/i.test(p));
  if (parts.length < 2) return null;
  const picked = parts.length === 2 ? parts : [parts[0]!, parts[parts.length - 1]!];
  return picked.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

export const ospContactsConnector: SourceConnector = {
  meta: {
    id: 'mn-osp-contacts',
    sourceName: 'OSP Procurement Contacts',
    url: URL,
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'browser',
    description: 'Named Minnesota state procurement contacts by office (name, title, phone, email).',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-osp-contacts requires a browser fetcher');
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
    const offices = new Set<string>();

    out.push(
      extract.entity(
        { name: ENTITY, entityType: 'state_agency', jurisdiction: 'MN', website: 'https://mn.gov/admin/osp/' },
        [evidenceSpan('h1', 'State Procurement', at)],
        { confidence: 0.95 },
      ),
    );

    let currentOffice: string | null = null;
    const seen = new Set<string>();

    $('h2, h3, a[href^="mailto:"]').each((_i, el) => {
      const $el = $(el);
      const tag = (el as Element).tagName;
      if (tag === 'h2' || tag === 'h3') {
        const office = officeFromHeading($el.text());
        if (office) {
          currentOffice = office;
          if (!offices.has(office)) {
            offices.add(office);
            out.push(
              extract.office(
                { name: office, entityName: ENTITY, entityType: 'state_agency', url: URL },
                [evidenceSpan(`${tag}`, $el.text().replace(/\s+/g, ' ').trim(), at)],
                { confidence: 0.9 },
              ),
            );
          }
        }
        return;
      }
      // mailto link
      const email = ($el.attr('href') ?? '').replace(/^mailto:/i, '').trim();
      if (!email) return;
      const ctxText = $el.closest('p,li,td,div').text().replace(/\s+/g, ' ').trim();
      if (!/Phone:/i.test(ctxText)) return; // skip generic help-line / bare emails
      const emailName = nameFromEmail(email);
      if (!emailName) return;
      const phone = ctxText.match(/Phone:\s*([()\d][()\d\s-]{6,})/i)?.[1]?.trim() ?? null;
      const beforePhone = ctxText.split(/Phone:/i)[0]?.trim() ?? '';
      const words = beforePhone.split(/\s+/).filter(Boolean);
      const wordCount = emailName.split(' ').length;
      // Prefer the actual name as rendered on the page (so the stored name is backed by the
      // evidence snippet); the email only tells us how many leading words form the name.
      const startsWithName = beforePhone.toLowerCase().startsWith(emailName.toLowerCase());
      const name = startsWithName && words.length >= wordCount ? words.slice(0, wordCount).join(' ') : emailName;
      const title = (startsWithName ? beforePhone.slice(name.length).trim() : words.slice(wordCount).join(' ')) || null;
      const key = `${email}|${title ?? ''}|${currentOffice ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(
        extract.contact(
          {
            name,
            title,
            email,
            phone,
            entityName: ENTITY,
            entityType: 'state_agency',
            ...(currentOffice ? { officeName: currentOffice } : {}),
          },
          [evidenceSpan(`a[href="mailto:${email}"]`, ctxText.slice(0, 200), at)],
          { confidence: 0.9 },
        ),
      );
    });

    return out;
  },
};
