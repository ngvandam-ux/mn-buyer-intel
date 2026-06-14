/**
 * Live ingest: fetch from the real sources (network) and normalize into the DB.
 *
 *   pnpm ingest            # all live connectors
 *   pnpm ingest -- <id>    # a single connector, e.g. mn-sourcewell
 */

import { closeBrowser, createFetchContext, getConnector, liveConnectors } from '@mn/connectors';
import { createDb, runMigrations } from '@mn/db';
import { ingestConnector } from '@mn/ingest';

async function main(): Promise<void> {
  const id = process.argv[2];
  const targets = id ? [getConnector(id)] : liveConnectors();
  if (id && !targets[0]) {
    console.error(`unknown connector: ${id}`);
    process.exit(1);
  }

  await runMigrations();
  const handle = await createDb();
  try {
    for (const connector of targets) {
      if (!connector) continue;
      console.log(`[ingest] ${connector.meta.id} (${connector.meta.fetchMode})…`);
      const ctx = createFetchContext(connector.meta.id);
      const summary = await ingestConnector(handle.db, connector, ctx);
      console.log(
        `  ${summary.status} docs=${summary.documentsFetched} parsed=${summary.extractionsParsed} upserted=${summary.recordsUpserted}` +
          (summary.error ? ` error=${summary.error}` : ''),
      );
    }
  } finally {
    await closeBrowser();
    await handle.close();
  }
}

main().catch((err) => {
  console.error('[ingest] failed:', err);
  process.exit(1);
});
