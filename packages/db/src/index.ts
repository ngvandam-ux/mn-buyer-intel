// Public surface of @mn/db.

export * from './schema.js';
export * from './client.js';
export * from './types.js';
export { runMigrations } from './migrate.js';
export { newId, sha256 } from './ids.js';

// Re-export the operators consumers need so they don't import drizzle-orm directly.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
