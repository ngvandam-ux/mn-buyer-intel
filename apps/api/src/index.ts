import { getDb, runMigrations } from '@mn/db';
import { buildServer } from './server.js';
import { startScheduler } from './scheduler.js';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  // Ensure schema exists (no-op if already migrated).
  await runMigrations();
  const db = await getDb();
  const app = await buildServer(db);
  startScheduler(db);
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`mn-buyer-intel API on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
