/**
 * Capture fresh source snapshots into fixtures/ (network). Used to refresh the committed
 * fixtures that seed + parser tests run against.
 *
 *   pnpm capture            # all live connectors
 *   pnpm capture -- <id>    # a single connector
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  closeBrowser,
  createFetchContext,
  fixturesRoot,
  getConnector,
  liveConnectors,
  looksLikeBotWall,
} from '@mn/connectors';

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').slice(0, 16);
}

async function main(): Promise<void> {
  const id = process.argv[2];
  const targets = id ? [getConnector(id)] : liveConnectors();
  if (id && !targets[0]) {
    console.error(`unknown connector: ${id}`);
    process.exit(1);
  }
  const ts = stamp();

  try {
    for (const connector of targets) {
      if (!connector) continue;
      const ctx = createFetchContext(connector.meta.id);
      try {
        const docs = await connector.fetch(ctx);
        const dir = resolve(fixturesRoot(), connector.meta.id);
        mkdirSync(dir, { recursive: true });
        docs.forEach((doc, i) => {
          const ext = doc.contentType.includes('json') ? 'json' : 'html';
          const suffix = docs.length > 1 ? `_${i}` : '';
          const file = resolve(dir, `${ts}${suffix}.${ext}`);
          writeFileSync(file, doc.body, 'utf8');
          const flag = looksLikeBotWall(doc.body) ? ' [BOT WALL]' : '';
          console.log(`  ${connector.meta.id.padEnd(22)} ${doc.body.length}b -> fixtures/${connector.meta.id}/${ts}${suffix}.${ext}${flag}`);
        });
      } catch (err) {
        console.log(`  ${connector.meta.id.padEnd(22)} FAILED ${String(err).slice(0, 120)}`);
      }
    }
  } finally {
    await closeBrowser();
  }
}

main().catch((err) => {
  console.error('[capture] failed:', err);
  process.exit(1);
});
