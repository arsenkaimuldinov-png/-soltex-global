/**
 * Export the content database in seed format.
 *   DATABASE_URL=… npm run db:export -w @soltex/api -- --out <dir>        (ten seed files)
 *   DATABASE_URL=… npm run db:export -w @soltex/api -- --file <store.json> (one ContentStore file,
 *     consumed by the site build with CONTENT_SOURCE=file CONTENT_STORE_FILE=<store.json>)
 */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../db/client.ts';
import { exportStore } from '../content/export.ts';
import { serialize, writeSeedDir } from '../content/seed-files.ts';
import { env } from './args.ts';

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : undefined;
const file = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : undefined;
if (!out && !file) {
  console.error('usage: db-export --out <dir> | --file <store.json>');
  process.exit(2);
}
const { db, close } = connect(env('DATABASE_URL'), 1);
try {
  // One consistent snapshot of all tables (approved architecture §4.1, step 1).
  const store = await db.transaction((tx) => exportStore(tx), { isolationLevel: 'repeatable read', accessMode: 'read only' });
  if (out) {
    writeSeedDir(store, path.resolve(out));
    console.log(`db:export: seed files → ${path.resolve(out)}`);
  }
  if (file) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(path.resolve(file), serialize(store));
    console.log(`db:export: content store → ${path.resolve(file)}`);
  }
} finally {
  await close();
}
