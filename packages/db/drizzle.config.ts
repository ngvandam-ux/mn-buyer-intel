import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads the schema and emits SQL migrations into ./drizzle.
// No DB connection is needed to generate. The migrator (src/migrate.ts) applies them
// after enabling the pgvector extension.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
});
