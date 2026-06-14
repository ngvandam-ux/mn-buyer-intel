/**
 * Apply migrations to the configured database.
 *
 * pgvector is enabled before the schema migration runs, since `opportunities.embedding`
 * is a `vector` column. PGlite registers the extension via the client; a real Postgres
 * must have pgvector available (Supabase and most managed Postgres do).
 *
 * Run with: `pnpm db:migrate`
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate as migrateNode } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb } from './client.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(HERE, '../drizzle');

export async function runMigrations(): Promise<void> {
  const handle = await createDb();
  try {
    await handle.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    if (handle.kind === 'pglite') {
      await migratePglite(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
    } else {
      await migrateNode(handle.db as unknown as NodePgDatabase, {
        migrationsFolder: MIGRATIONS_FOLDER,
      });
    }
    console.log(`[db] migrations applied (${handle.kind})`);
  } finally {
    await handle.close();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  runMigrations().catch((err) => {
    console.error('[db] migration failed:', err);
    process.exit(1);
  });
}
