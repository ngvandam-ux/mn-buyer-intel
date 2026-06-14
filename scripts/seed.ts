/**
 * Seed the dev database from committed fixtures, then create sample seller profiles and
 * run matching for them. Offline + deterministic — no network.
 *
 *   pnpm seed
 *
 * Idempotent for ingested data (upserts). Seller profiles are reset to the sample set.
 */

import { liveConnectors } from '@mn/connectors';
import { createDb, eq, runMigrations, sellerProfiles } from '@mn/db';
import { ingestFromFixture } from '@mn/ingest';
import { runMatching } from '@mn/matching';

interface SampleSeller {
  companyName: string;
  capabilities: string[];
  services: string[];
  products: string[];
  keywords: string[];
  certifications: string[];
  categories: string[];
  geographies: string[];
  notes: string;
}

const SAMPLE_SELLERS: SampleSeller[] = [
  {
    companyName: 'NorthStar Fiber & Telecom',
    capabilities: ['fiber optic installation', 'broadband network construction', 'structured cabling'],
    services: ['network design', 'fiber splicing', 'wireless backhaul'],
    products: ['fiber optic cable', 'network switches'],
    keywords: ['fiber', 'broadband', 'telecom', 'cabling', 'wan'],
    certifications: ['Targeted Group Business'],
    categories: ['telecom', 'it_hardware'],
    geographies: ['statewide'],
    notes: 'Statewide fiber and broadband contractor.',
  },
  {
    companyName: 'Granite Fleet Solutions',
    capabilities: ['fleet maintenance', 'vehicle upfitting', 'snow and ice equipment'],
    services: ['preventive maintenance', 'fuel management'],
    products: ['snowplows', 'patrol vehicles', 'tires'],
    keywords: ['fleet', 'vehicles', 'snowplow', 'fuel', 'heavy equipment'],
    certifications: [],
    categories: ['fleet'],
    geographies: ['statewide'],
    notes: 'Fleet and heavy-equipment supplier and service provider.',
  },
  {
    companyName: 'Sentinel Public Safety Group',
    capabilities: ['public safety equipment', 'body-worn cameras', 'two-way radio systems'],
    services: ['training', 'system installation'],
    products: ['body cameras', 'less lethal equipment', 'radios'],
    keywords: ['public safety', 'body camera', 'radio', 'law enforcement', 'emergency'],
    certifications: ['Veteran-Owned Small Business'],
    categories: ['safety', 'security_services'],
    geographies: ['statewide'],
    notes: 'Public safety and law-enforcement equipment + training.',
  },
  {
    companyName: 'BluePrairie Software',
    capabilities: ['enterprise software', 'cloud platform implementation', 'data analytics'],
    services: ['software implementation', 'cybersecurity assessment', 'managed services'],
    products: ['ERP modules', 'analytics platform'],
    keywords: ['software', 'saas', 'cloud', 'cybersecurity', 'analytics', 'erp'],
    certifications: [],
    categories: ['software', 'cybersecurity'],
    geographies: ['statewide'],
    notes: 'Government software, cloud, and cybersecurity vendor.',
  },
];

async function main(): Promise<void> {
  await runMigrations();
  const handle = await createDb();
  try {
    console.log('[seed] ingesting live connectors from fixtures…');
    for (const connector of liveConnectors()) {
      const summary = await ingestFromFixture(handle.db, connector);
      if (!summary) {
        console.log(`  ${connector.meta.id.padEnd(22)} — no fixture, skipped`);
        continue;
      }
      console.log(
        `  ${connector.meta.id.padEnd(22)} ${summary.status.padEnd(8)} parsed=${summary.extractionsParsed} upserted=${summary.recordsUpserted}`,
      );
    }

    console.log('[seed] resetting + creating sample seller profiles…');
    for (const s of SAMPLE_SELLERS) {
      await handle.db.delete(sellerProfiles).where(eq(sellerProfiles.companyName, s.companyName));
      const [row] = await handle.db.insert(sellerProfiles).values(s).returning();
      const result = await runMatching(handle.db, row!.id);
      const topOpps = result.opportunityMatches.slice(0, 3);
      console.log(
        `  ${s.companyName.padEnd(30)} matches: ${result.opportunityMatches.length} opps / ${result.entityMatches.length} buyers` +
          (topOpps[0] ? ` | top: ${topOpps[0].tier} ${topOpps[0].score}` : ''),
      );
    }
    console.log('[seed] done.');
  } finally {
    await handle.close();
  }
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
