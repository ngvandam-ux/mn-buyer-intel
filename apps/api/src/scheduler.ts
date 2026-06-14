/**
 * Scheduled refresh. Off by default; set REFRESH_CRON (e.g. "0 6 * * *") to enable a
 * live refresh of all live connectors. The job functions are plain async calls, so this
 * can be swapped for BullMQ / Temporal without touching ingest logic.
 */

import { closeBrowser, createFetchContext, liveConnectors } from '@mn/connectors';
import type { AppDatabase } from '@mn/db';
import { ingestConnector } from '@mn/ingest';
import cron from 'node-cron';

export async function refreshAll(db: AppDatabase, log: (m: string) => void = console.log): Promise<void> {
  for (const connector of liveConnectors()) {
    try {
      const ctx = createFetchContext(connector.meta.id);
      const summary = await ingestConnector(db, connector, ctx);
      log(`[refresh] ${connector.meta.id}: ${summary.status} (${summary.recordsUpserted} upserted)`);
    } catch (err) {
      log(`[refresh] ${connector.meta.id}: error ${String(err).slice(0, 120)}`);
    }
  }
  await closeBrowser();
}

export function startScheduler(db: AppDatabase): void {
  const expr = process.env.REFRESH_CRON;
  if (!expr) return;
  if (!cron.validate(expr)) {
    console.warn(`[scheduler] invalid REFRESH_CRON "${expr}" — not scheduling`);
    return;
  }
  cron.schedule(expr, () => {
    console.log('[scheduler] running scheduled refresh');
    void refreshAll(db);
  });
  console.log(`[scheduler] live refresh scheduled: ${expr}`);
}
