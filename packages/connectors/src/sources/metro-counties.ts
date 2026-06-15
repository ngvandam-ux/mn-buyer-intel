/**
 * Twin Cities 7-county metro as public buyers. Each county is seeded as a `county` entity
 * (metro=true) with an approximate centroid so it appears on the map, plus a
 * cooperative-pathway signal describing how to do business (county bid platforms are
 * JS/registration-gated — ProcureWare, DemandStar — so live opportunity scraping is a
 * follow-up; the counties exist here as buyers with procurement pathways now).
 *
 * `parse` emits all 7 county entities (reference data, evidence = each county's site) plus
 * the fetched county's purchasing office + pathway signal. Offline (one fixture) still
 * yields all 7 counties.
 */

import type { Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';
import { collapseWhitespace, evidenceSpan } from '@mn/core';
import { extract } from '../extraction.js';

interface County {
  name: string;
  county: string;
  website: string;
  contractsUrl: string;
  urlKey: string;
  platform: string;
  lat: number;
  lng: number;
}

const COUNTIES: County[] = [
  { name: 'Hennepin County', county: 'Hennepin', website: 'https://www.hennepin.us', contractsUrl: 'https://www.hennepin.us/business/work-with-henn-co/contracting-with-hennepin-county', urlKey: 'hennepin.us', platform: 'Hennepin Supplier Portal (ProcureWare)', lat: 45.0, lng: -93.47 },
  { name: 'Ramsey County', county: 'Ramsey', website: 'https://www.ramseycountymn.gov', contractsUrl: 'https://www.ramseycountymn.gov/businesses/doing-business-ramsey-county/contracts-vendors', urlKey: 'ramseycountymn.gov', platform: 'DemandStar', lat: 45.02, lng: -93.1 },
  { name: 'Dakota County', county: 'Dakota', website: 'https://www.co.dakota.mn.us', contractsUrl: 'https://www.co.dakota.mn.us/Government/Purchasing/Pages/default.aspx', urlKey: 'dakota.mn.us', platform: 'County procurement portal', lat: 44.67, lng: -93.06 },
  { name: 'Anoka County', county: 'Anoka', website: 'https://www.anokacountymn.gov', contractsUrl: 'https://www.anokacountymn.gov/319/Purchasing', urlKey: 'anokacountymn.gov', platform: 'County procurement portal', lat: 45.27, lng: -93.25 },
  { name: 'Washington County', county: 'Washington', website: 'https://www.washingtoncountymn.gov', contractsUrl: 'https://www.washingtoncountymn.gov/183/Purchasing', urlKey: 'washingtoncountymn.gov', platform: 'County procurement portal', lat: 45.04, lng: -92.88 },
  { name: 'Scott County', county: 'Scott', website: 'https://www.scottcountymn.gov', contractsUrl: 'https://www.scottcountymn.gov/161/Purchasing', urlKey: 'scottcountymn.gov', platform: 'County procurement portal', lat: 44.65, lng: -93.54 },
  { name: 'Carver County', county: 'Carver', website: 'https://www.carvercountymn.gov', contractsUrl: 'https://www.carvercountymn.gov/departments/property-finance/purchasing', urlKey: 'carvercountymn.gov', platform: 'County procurement portal', lat: 44.82, lng: -93.8 },
];

function countyForDoc(url: string, text: string): County | undefined {
  const byUrl = COUNTIES.find((c) => url.includes(c.urlKey));
  if (byUrl) return byUrl;
  const head = text.slice(0, 1500).toLowerCase();
  return COUNTIES.find((c) => head.includes(c.name.toLowerCase()));
}

export const metroCountiesConnector: SourceConnector = {
  meta: {
    id: 'mn-metro-counties',
    sourceName: 'Twin Cities Metro Counties',
    url: 'https://www.ramseycountymn.gov/businesses/doing-business-ramsey-county/contracts-vendors',
    jurisdiction: 'MN',
    entityHint: 'county',
    fetchMode: 'static',
    description: '7-county Twin Cities metro buyers + procurement pathways (Hennepin, Ramsey, Dakota, Anoka, Washington, Scott, Carver).',
    live: true,
  },

  async fetch(ctx: FetchContext): Promise<RawDocument[]> {
    const docs: RawDocument[] = [];
    for (const c of COUNTIES) {
      try {
        docs.push(await ctx.fetchStatic(c.contractsUrl, { timeoutMs: 25_000 }));
      } catch (err) {
        ctx.log(`skip ${c.county}: ${String(err).slice(0, 90)}`);
      }
    }
    return docs;
  },

  parse(raw: RawDocument): Extraction[] {
    const at = raw.fetchedAt;
    const out: Extraction[] = [];

    // All 7 metro counties as buyers (reference data, evidence = each county's site).
    for (const c of COUNTIES) {
      out.push(
        extract.entity(
          {
            name: c.name,
            entityType: 'county',
            jurisdiction: 'MN',
            county: c.county,
            metro: true,
            lat: c.lat,
            lng: c.lng,
            website: c.website,
          },
          [evidenceSpan(`website`, c.website, at)],
          { confidence: 0.95 },
        ),
      );
    }

    // The fetched county gets a purchasing office + a how-to-do-business pathway signal.
    const cfg = countyForDoc(raw.url, raw.body);
    if (cfg) {
      out.push(
        extract.office(
          { name: `${cfg.county} County Purchasing & Contracting`, entityName: cfg.name, entityType: 'county', url: cfg.contractsUrl },
          [evidenceSpan('contracts page', cfg.contractsUrl, at)],
          { confidence: 0.85 },
        ),
      );
      out.push(
        extract.signal(
          {
            signalType: 'cooperative_pathway',
            title: `Do business with ${cfg.name}`,
            detail: `Register/respond via ${cfg.platform}. See ${cfg.contractsUrl}.`,
            url: cfg.contractsUrl,
            entityName: cfg.name,
            entityType: 'county',
            observedAt: at,
            strength: 0.5,
          },
          [evidenceSpan('contracts page', collapseWhitespace(raw.body.replace(/<[^>]+>/g, ' ')).slice(0, 200), at)],
          { confidence: 0.8 },
        ),
      );
    }

    return out;
  },
};
