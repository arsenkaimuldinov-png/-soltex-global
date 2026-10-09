/**
 * Apply the committed SQL migrations (./drizzle) with the migration role.
 *   MIGRATION_DATABASE_URL=postgres://soltex_migrate:…@127.0.0.1:5432/soltex npm run db:migrate -w @soltex/api
 * The application role (DATABASE_URL) has no right to change the schema.
 * Afterwards existing translation approvals are linked to the source revision (content/reconcile.ts)
 * and content without revisions gets its baseline revision (publishing/revisions.ts).
 */
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { connect } from '../db/client.ts';
import { reconcileApprovals } from '../content/reconcile.ts';
import { syncRevisions } from '../publishing/revisions.ts';
import { env } from './args.ts';

const { db, close } = connect(env('MIGRATION_DATABASE_URL'), 1);
try {
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../../drizzle') });
  console.log('db:migrate: schema is up to date');
  // Phase F: link approvals made before migration 0004 to the source revision (idempotent).
  const linked = await db.transaction((tx) => reconcileApprovals(tx));
  if (linked) console.log(`db:migrate: ${linked} existing approvals linked to the current source revision`);
  // Phase G: existing content gets its first (baseline) revision (idempotent).
  const revisions = await db.transaction((tx) => syncRevisions(tx, 'import'));
  if (revisions) console.log(`db:migrate: ${revisions} content revisions written (baseline)`);
} finally {
  await close();
}
