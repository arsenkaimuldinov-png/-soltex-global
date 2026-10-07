import { defineConfig } from 'drizzle-kit';

// Generates reviewed SQL migrations from src/db/schema.ts into ./drizzle (committed).
// Applying migrations uses MIGRATION_DATABASE_URL (role soltex_migrate), never the app role.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
});
