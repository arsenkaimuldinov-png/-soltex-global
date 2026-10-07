/**
 * Apply the committed SQL migrations (./drizzle) with the migration role.
 *   MIGRATION_DATABASE_URL=postgres://soltex_migrate:…@127.0.0.1:5432/soltex npm run db:migrate -w @soltex/api
 * The application role (DATABASE_URL) has no right to change the schema.
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connect } from '../db/client.ts';
import { env } from './args.ts';

const { db, close } = connect(env('MIGRATION_DATABASE_URL'), 1);
try {
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle') });
  console.log('db:migrate: schema is up to date');
} finally {
  await close();
}
