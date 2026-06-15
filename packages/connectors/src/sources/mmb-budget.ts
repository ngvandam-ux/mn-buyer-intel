/**
 * Minnesota Management & Budget (MMB) biennial budget books — per-agency PDFs. Tilted to
 * technology/products: MNIT first, plus a few agencies whose budgets fund products/tech.
 *
 * Budget books share a layout: an "...by Program ... Total <yearly figures>" table (dollars
 * in thousands) and a "STRATEGIES" narrative. We extract the agency's total budget + trend
 * as a `budget` line (category-tagged), plus strategic-priority + budget signals. Best-effort
 * and confidence-scored — flows through the admin review queue.
 */

import type { EntityType, Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { collapseWhitespace, detectCapabilities, detectCategories, evidenceSpan } from '@mn/core';
import { extract } from '../extraction.js';

const BIENNIUM = '2026-27';
const STAGE = 'governors-revised-march';
const base = (slug: string) =>
  `https://mn.gov/mmb-stat/documents/budget/${BIENNIUM}-biennial-budget-books/${STAGE}/${slug}.pdf`;

interface AgencyConfig {
  slug: string;
  entityName: string;
  entityType: EntityType;
  baseCategories: string[];
}

// Slugs confirmed against the MMB budget-book URL pattern; fetched tolerantly (a wrong slug
// just logs + skips). Capability mining + categories surface what each agency is buying.
const AGENCIES: AgencyConfig[] = [
  { slug: 'mn-it-services', entityName: 'Minnesota IT Services', entityType: 'state_agency', baseCategories: ['software', 'it_hardware', 'cybersecurity', 'telecom'] },
  { slug: 'transportation', entityName: 'Minnesota Department of Transportation', entityType: 'state_agency', baseCategories: ['transportation_transit', 'construction', 'fleet'] },
  { slug: 'health', entityName: 'Minnesota Department of Health', entityType: 'state_agency', baseCategories: ['medical', 'software'] },
  { slug: 'corrections', entityName: 'Minnesota Department of Corrections', entityType: 'state_agency', baseCategories: ['safety', 'security_services', 'medical'] },
  { slug: 'education', entityName: 'Minnesota Department of Education', entityType: 'state_agency', baseCategories: ['training', 'software'] },
  { slug: 'administration', entityName: 'Minnesota Department of Administration', entityType: 'state_agency', baseCategories: ['professional_services', 'facilities', 'software'] },
  { slug: 'military-affairs', entityName: 'Minnesota Department of Military Affairs', entityType: 'military_national_guard', baseCategories: ['safety', 'facilities', 'training'] },
  { slug: 'human-services', entityName: 'Minnesota Department of Human Services', entityType: 'state_agency', baseCategories: ['medical', 'software', 'professional_services'] },
  { slug: 'natural-resources', entityName: 'Minnesota Department of Natural Resources', entityType: 'state_agency', baseCategories: ['environmental', 'fleet', 'construction'] },
];

const FISCAL_PERIOD = `FY${BIENNIUM}`;

// The distinctive part of an agency name (drops the "Minnesota Department of" prefix).
const distinctive = (name: string) => name.replace(/^minnesota (department of )?/i, '').toLowerCase();

function configForDoc(url: string, text: string): AgencyConfig | undefined {
  const byUrl = AGENCIES.find((a) => url.includes(`/${a.slug}.pdf`));
  if (byUrl) return byUrl;
  // Fixture/offline path: the URL is the landing page, so identify by the agency named in
  // the budget book's title area (first ~500 chars: "...Contents <Agency Name>...").
  const head = text.slice(0, 500).toLowerCase();
  return AGENCIES.find((a) => head.includes(distinctive(a.entityName)));
}

function sectionSnippet(text: string, marker: RegExp, len = 320): string | null {
  const m = text.match(marker);
  if (!m || m.index === undefined) return null;
  return collapseWhitespace(text.slice(m.index, m.index + len));
}

export const mmbBudgetConnector: SourceConnector = {
  meta: {
    id: 'mn-mmb-budget',
    sourceName: 'MN Management & Budget — Agency Budget Books',
    url: 'https://mn.gov/mmb/budget/current-budget/current-enacted-budget/',
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'static',
    description: 'State agency budgets + tech/IT appropriations + strategic priorities (PDF budget books).',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchPdf) throw new Error('mn-mmb-budget requires a PDF fetcher');
    const docs: RawDocument[] = [];
    for (const a of AGENCIES) {
      try {
        docs.push(await ctx.fetchPdf(base(a.slug)));
      } catch (err) {
        ctx.log(`skip ${a.slug}: ${String(err).slice(0, 100)}`);
      }
    }
    return docs;
  },

  parse(raw: RawDocument): Extraction[] {
    const text = raw.body;
    const cfg = configForDoc(raw.url, text);
    if (!cfg) return [];
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    // --- agency entity ---
    out.push(
      extract.entity(
        { name: cfg.entityName, entityType: cfg.entityType, jurisdiction: 'MN' },
        [evidenceSpan(`pdf:${cfg.slug}`, cfg.entityName, at)],
        { confidence: 0.9 },
      ),
    );

    // --- total budget from the "by Program ... Total <figures>" table (thousands) ---
    const byProg = text.indexOf('by Program');
    const region = byProg >= 0 ? text.slice(byProg, byProg + 2000) : text;
    const totalMatch = region.match(/Total((?:\s+[\d,]+){4,})/);
    const programMatch = region.match(/by Program\s+([A-Za-z][A-Za-z ,/&-]+?)\s+[\d,]{3,}/);
    const program = programMatch?.[1]?.trim() || `${cfg.entityName} total budget`;

    let amount: number | null = null;
    let priorAmount: number | null = null;
    let trendDelta: number | null = null;
    if (totalMatch) {
      const nums = (totalMatch[1] ?? '')
        .trim()
        .split(/\s+/)
        .map((n) => Number(n.replace(/,/g, '')))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (nums.length >= 2) {
        // Columns run earliest→latest; use the forward (governor's out-year) figure as the
        // funded level and the earliest as prior — avoids one-time mid-series spikes.
        const current = nums[nums.length - 1]!;
        const first = nums[0]!;
        amount = current * 1000; // MMB figures are in thousands
        priorAmount = first * 1000;
        trendDelta = first > 0 ? Math.round(((current - first) / first) * 1000) / 1000 : null;
      }
    }

    const strategies = sectionSnippet(text, /STRATEGIES/);
    // Specific capabilities the agency is funding/seeking — the "what they want" detail.
    const capabilities = detectCapabilities(text);
    const categoryKeys = Array.from(
      new Set([
        ...cfg.baseCategories,
        ...detectCategories(`${program} ${strategies ?? ''} ${region}`),
        ...capabilities.map((c) => c.category),
      ]),
    );

    out.push(
      extract.budget(
        {
          entityName: cfg.entityName,
          entityType: cfg.entityType,
          program,
          categoryKeys,
          fiscalPeriod: FISCAL_PERIOD,
          fund: 'All funds',
          amount,
          priorAmount,
          trendDelta,
          narrative: strategies,
        },
        [evidenceSpan('by Program · Total', collapseWhitespace(region.slice(0, 200)), at)],
        { confidence: amount ? 0.75 : 0.5, partial: !amount },
      ),
    );

    // --- specific capability-demand signals ("what they're looking for") ---
    if (capabilities.length > 0) {
      for (const cap of capabilities.slice(0, 10)) {
        out.push(
          extract.signal(
            {
              signalType: 'strategic_initiative',
              title: `${cfg.entityName} demand: ${cap.label}`,
              detail: cap.snippet,
              url: raw.url,
              entityName: cfg.entityName,
              entityType: cfg.entityType,
              observedAt: at,
              strength: 0.5,
            },
            [evidenceSpan(`budget narrative · ${cap.key}`, cap.snippet.slice(0, 180), at)],
            { confidence: 0.7 },
          ),
        );
      }
    } else if (strategies) {
      out.push(
        extract.signal(
          {
            signalType: 'strategic_initiative',
            title: `${cfg.entityName} ${FISCAL_PERIOD} strategic priorities`,
            detail: strategies,
            url: raw.url,
            entityName: cfg.entityName,
            entityType: cfg.entityType,
            observedAt: at,
          },
          [evidenceSpan('STRATEGIES', strategies.slice(0, 200), at)],
          { confidence: 0.8 },
        ),
      );
    }

    // --- budget-priority signal (headline funded demand) ---
    if (amount) {
      const millions = Math.round(amount / 1_000_000);
      out.push(
        extract.signal(
          {
            signalType: 'budget_priority',
            title: `${cfg.entityName} ${FISCAL_PERIOD} budget ≈ $${millions}M${trendDelta ? ` (${trendDelta > 0 ? '+' : ''}${Math.round(trendDelta * 100)}%)` : ''}`,
            detail: `Funded ${categoryKeys.join(', ')} demand. Program: ${program}.`,
            url: raw.url,
            entityName: cfg.entityName,
            entityType: cfg.entityType,
            observedAt: at,
            strength: 0.6,
          },
          [evidenceSpan('by Program · Total', `${program} total`, at)],
          { confidence: 0.7 },
        ),
      );
    }

    return out;
  },
};
