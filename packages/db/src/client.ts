/**
 * Database client factory. One schema, two drivers, chosen by `DATABASE_URL`:
 *
 *   (unset) or `pglite://<dir>`  → PGlite (in-process WASM Postgres, file-backed)  [dev]
 *   `postgres://…` / `postgresql://…` → node-postgres connection pool               [prod]
 *
 * Both expose the identical Drizzle query API. We type the app DB as the PGlite variant
 * and cast the node-postgres instance to it — the runtime surface is the same.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type AppDatabase = PgliteDatabase<typeof schema>;
export type DriverKind = 'pglite' | 'postgres';

export interface DbHandle {
  db: AppDatabase;
  kind: DriverKind;
  /** Underlying client/pool, exposed for the migrator and for clean shutdown. */
  raw: PGlite | pg.Pool;
  close(): Promise<void>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

export interface DbConfig {
  kind: DriverKind;
  /** PGlite data directory (when kind === 'pglite'). */
  dataDir: string;
  /** Postgres connection string (when kind === 'postgres'). */
  connectionString: string | null;
}

export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const url = env.DATABASE_URL?.trim();
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    return { kind: 'postgres', dataDir: '', connectionString: url };
  }
  let dataDir = env.PGLITE_DATA?.trim() || resolve(REPO_ROOT, 'data/pglite');
  if (url && url.startsWith('pglite://')) dataDir = resolve(url.slice('pglite://'.length));
  return { kind: 'pglite', dataDir, connectionString: null };
}

/** Create a fresh database handle. Prefer {@link getDb} for the shared singleton. */
export async function createDb(env: NodeJS.ProcessEnv = process.env): Promise<DbHandle> {
  const cfg = resolveDbConfig(env);
  if (cfg.kind === 'postgres') {
    const pool = new pg.Pool({ connectionString: cfg.connectionString! });
    const db = drizzleNode(pool, { schema }) as unknown as AppDatabase;
    return { db, kind: 'postgres', raw: pool, close: () => pool.end() };
  }
  mkdirSync(cfg.dataDir, { recursive: true });
  const client = new PGlite(cfg.dataDir, { extensions: { vector } });
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  return { db, kind: 'pglite', raw: client, close: () => client.close() };
}

// `schema` namespace is internal (passed to drizzle for relational queries). Consumers
// import individual tables from '@mn/db' directly.

let singleton: Promise<DbHandle> | null = null;

/** Shared process-wide handle. */
export function getDbHandle(): Promise<DbHandle> {
  if (!singleton) singleton = createDb();
  return singleton;
}

export async function getDb(): Promise<AppDatabase> {
  return (await getDbHandle()).db;
}
