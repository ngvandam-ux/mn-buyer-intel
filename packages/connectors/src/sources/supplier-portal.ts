/**
 * Minnesota Supplier Portal (PeopleSoft FSCM Fluid) — public bidding events.
 *
 * The "Bidding Event Information" component renders a grid where each row carries stable
 * PeopleSoft cell ids suffixed with `$<rowIndex>`. We read by id prefix, which is far
 * more robust than column position.
 *
 * Source: SCP_PUB_BID_CMP_FL — Event Name | Business Unit | Event ID | Format | Type |
 *         Ends In | Start Date | End Date | Details.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { evidenceSpan } from '@mn/core';
import * as cheerio from 'cheerio';
import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { extract } from '../extraction.js';
import { looksLikeBotWall } from '../runtime/bot-wall.js';
import { parseUsDateTime } from '../runtime/dates.js';

const ID =
  'https://guest.supplier.systems.state.mn.us/psc/fmssupap/SUPPLIER/ERP/c/SCP_PUBLIC_MENU_FL.SCP_PUB_BID_CMP_FL.GBL';

const CELL = {
  name: 'win0divSCP_PUB_AUC_VW_AUC_NAME',
  businessUnit: 'win0divBUS_UNIT_AUC_VW_DESCR',
  eventId: 'win0divSCP_PUB_AUC_VW_AUC_ID',
  format: 'win0divSCP_PUB_AUC_VW_AUC_FORMAT',
  type: 'win0divSCP_PUB_AUC_VW_AUC_TYPE',
  endsIn: 'win0divSCP_COSP_WK_FL_HTML_AREA_03',
  startDate: 'win0divSCP_COSP_WK_FL_SCP_STRT_DATE_CHAR',
  endDate: 'win0divSCP_COSP_WK_FL_SCP_END_DATE_CHAR',
} as const;

export const supplierPortalConnector: SourceConnector = {
  meta: {
    id: 'mn-supplier-portal',
    sourceName: 'Minnesota Supplier Portal — Public Bids',
    url: ID,
    jurisdiction: 'MN',
    entityHint: 'state_agency',
    fetchMode: 'browser',
    description: 'PeopleSoft public bidding events across Minnesota state business units.',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    if (!ctx.fetchBrowser) throw new Error('mn-supplier-portal requires a browser fetcher');
    let doc = await ctx.fetchBrowser(ID, { settleMs: 6000, timeoutMs: 60_000 });
    if (looksLikeBotWall(doc.body)) {
      ctx.log('bot wall hit, retrying once');
      doc = await ctx.fetchBrowser(ID, { settleMs: 9000, timeoutMs: 60_000 });
    }
    return [doc];
  },

  parse(raw: RawDocument): Extraction[] {
    const $ = cheerio.load(raw.body);
    const at = raw.fetchedAt;
    const ref = new Date(raw.fetchedAt).getTime();
    const out: Extraction[] = [];
    const seenEntities = new Set<string>();

    const cellText = (row: Cheerio<Element>, prefix: string): string =>
      row.find(`[id^="${prefix}$"]`).first().text().replace(/\s+/g, ' ').trim();

    $('tr.ps_grid-row.psc_rowact').each((_i, tr) => {
      const row = $(tr);
      const title = cellText(row, CELL.name);
      if (!title) return;
      const businessUnit = cellText(row, CELL.businessUnit) || 'State of Minnesota';
      const externalId = cellText(row, CELL.eventId) || null;
      const format = cellText(row, CELL.format);
      const type = cellText(row, CELL.type);
      const endsIn = cellText(row, CELL.endsIn);
      const startRaw = cellText(row, CELL.startDate);
      const endRaw = cellText(row, CELL.endDate);
      const postedDate = parseUsDateTime(startRaw);
      const dueDate = parseUsDateTime(endRaw);

      let status: 'open' | 'upcoming' | 'closed' = 'open';
      if (dueDate && new Date(dueDate).getTime() < ref) status = 'closed';
      else if (postedDate && new Date(postedDate).getTime() > ref) status = 'upcoming';

      const descParts = [
        format && `Format: ${format}`,
        type && `Type: ${type}`,
        endsIn && `Ends in: ${endsIn}`,
        startRaw && `Start: ${startRaw}`,
        endRaw && `End: ${endRaw}`,
      ].filter(Boolean);

      if (!seenEntities.has(businessUnit)) {
        seenEntities.add(businessUnit);
        out.push(
          extract.entity(
            { name: businessUnit, entityType: 'state_agency', jurisdiction: 'MN' },
            [evidenceSpan(`#${CELL.businessUnit}$`, businessUnit, at)],
            { confidence: 0.85 },
          ),
        );
      }

      out.push(
        extract.opportunity(
          {
            externalId,
            title,
            description: descParts.join(' · ') || null,
            status,
            businessUnit,
            entityName: businessUnit,
            entityType: 'state_agency',
            solicitationType: type || format || null,
            postedDate,
            dueDate,
            url: ID,
          },
          [
            evidenceSpan(`#${CELL.name}$`, title, at),
            ...(externalId ? [evidenceSpan(`#${CELL.eventId}$`, externalId, at)] : []),
            ...(endRaw ? [evidenceSpan(`#${CELL.endDate}$`, endRaw, at)] : []),
          ],
          { confidence: 0.95 },
        ),
      );
    });

    return out;
  },
};
