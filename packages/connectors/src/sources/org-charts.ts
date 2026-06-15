/**
 * Org-chart / decision-maker connector. Pulls named purchasing/IT leadership from official
 * leadership pages so a seller knows *who to call*. Each leader is emitted only if their
 * name is still present on the live page (so departures drop off); titles come from the
 * official appointment/leadership record. Evidence = the leadership page.
 *
 * Bot-walled (mn.gov) → browser fetch. Extend `SOURCES` to add agencies; role/seniority are
 * inferred from title + employer during ingest (title intelligence).
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import { extract } from '../extraction.js';
import { looksLikeBotWall } from '../runtime/bot-wall.js';

interface LeadershipSource {
  entityName: string;
  entityType: 'state_agency' | 'county' | 'higher_education';
  url: string;
  urlKey: string;
  execs: Array<{ name: string; title: string }>;
}

const SOURCES: LeadershipSource[] = [
  {
    entityName: 'Minnesota IT Services',
    entityType: 'state_agency',
    url: 'https://mn.gov/mnit/about-mnit/leadership/',
    urlKey: '/mnit/about-mnit/leadership',
    // Verified on the official Executive Leadership Team page + appointment records.
    execs: [
      { name: 'Jon Eichten', title: 'Commissioner and State Chief Information Officer' },
      { name: 'Brandon Hirsch', title: 'Deputy Commissioner' },
      { name: 'John Israel', title: 'Assistant Commissioner and Chief Information Security Officer' },
      { name: 'Jeff Nyberg', title: 'Assistant Commissioner and Chief Technology Officer' },
    ],
  },
];

function sourceForDoc(url: string, text: string): LeadershipSource | undefined {
  return (
    SOURCES.find((s) => url.includes(s.urlKey)) ??
    SOURCES.find((s) => text.slice(0, 4000).includes(s.entityName))
  );
}

export const orgChartsConnector: SourceConnector = {
  meta: {
    id: 'mn-org-charts',
    sourceName: 'Procurement & IT Org Charts',
    url: 'https://mn.gov/mnit/about-mnit/leadership/',
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'browser',
    description: 'Named purchasing/IT decision-makers from official agency leadership pages (who to call).',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-org-charts requires a browser fetcher');
    const docs: RawDocument[] = [];
    for (const s of SOURCES) {
      try {
        let doc = await ctx.fetchBrowser(s.url, { settleMs: 3500, timeoutMs: 60_000 });
        if (looksLikeBotWall(doc.body)) doc = await ctx.fetchBrowser(s.url, { settleMs: 6000, timeoutMs: 60_000 });
        docs.push(doc);
      } catch (err) {
        ctx.log(`skip ${s.entityName}: ${String(err).slice(0, 90)}`);
      }
    }
    return docs;
  },

  parse(raw: RawDocument): Extraction[] {
    const src = sourceForDoc(raw.url, raw.body);
    if (!src) return [];
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    out.push(
      extract.entity(
        { name: src.entityName, entityType: src.entityType, jurisdiction: 'MN' },
        [evidenceSpan('leadership page', src.entityName, at)],
        { confidence: 0.9 },
      ),
    );

    for (const exec of src.execs) {
      // Only emit if the person is still listed on the live page.
      if (!raw.body.includes(exec.name)) continue;
      out.push(
        extract.contact(
          {
            name: exec.name,
            title: exec.title,
            entityName: src.entityName,
            entityType: src.entityType,
            officeName: 'Executive Leadership',
          },
          [evidenceSpan('leadership page', `${exec.name} — ${exec.title}`, at)],
          { confidence: 0.85 },
        ),
      );
    }

    return out;
  },
};
