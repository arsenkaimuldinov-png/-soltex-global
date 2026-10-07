/**
 * Import the seed (or any store in seed format) into the content database. Idempotent.
 *   DATABASE_URL=… npm run db:import -w @soltex/api -- --seed ../web/src/content/seed
 */
import path from 'node:path';
import { connect } from '../db/client.ts';
import { importStore } from '../content/import.ts';
import { readSeedDir } from '../content/seed-files.ts';
import { arg, env } from './args.ts';

const dir = path.resolve(arg('seed', path.resolve(import.meta.dirname, '../../../web/src/content/seed')));
const store = readSeedDir(dir);
const { db, close } = connect(env('DATABASE_URL'), 1);
try {
  const report = await db.transaction((tx) => importStore(tx, store));
  console.log(`db:import: ${dir}`);
  console.log(`  ${Object.entries(report.counts).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  for (const [k, keys] of Object.entries(report.notInStore))
    console.warn(`  note: ${keys.length} ${k} in the database are not in the store (kept): ${keys.join(', ')}`);
} finally {
  await close();
}
