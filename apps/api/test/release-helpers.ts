/**
 * Content fixtures shared by the redirect and nginx tests: the seed in the database, and the
 * working copy as the ACTIVE release (what the lookup endpoint serves) without running a build.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { connect } from '../src/db/client.ts';
import * as s from '../src/db/schema.ts';
import { exportStore } from '../src/content/export.ts';
import { importStore } from '../src/content/import.ts';
import { readSeedDir } from '../src/content/seed-files.ts';
import { snapshotStore } from '../src/publishing/releases.ts';
import { resetLookupCache } from '../src/seo/redirects.ts';
import type { TestApp } from './helpers.ts';

const SEED = path.resolve(import.meta.dirname, '../../web/src/content/seed');
const CONTENT_TABLES = [
  'media', 'media_translations', 'technologies', 'technology_translations', 'technology_projects',
  'projects', 'project_translations', 'project_gallery', 'products', 'product_translations',
  'epcm_stages', 'epcm_stage_translations', 'patents', 'patent_translations', 'videos', 'video_translations',
  'pages', 'page_translations', 'page_media', 'page_list_items', 'page_list_item_translations',
  'settings', 'settings_translations', 'metrics', 'metric_translations', 'offices', 'office_translations', 'redirects',
  'content_revisions', 'preview_grants', 'release_events', 'releases', 'content_snapshots',
];

export async function resetToSeed(t: TestApp) {
  const mig = connect(process.env.MIGRATION_DATABASE_URL!, 1);
  await mig.pool.query(`TRUNCATE ${CONTENT_TABLES.map((x) => `"${x}"`).join(', ')}`);
  await mig.close();
  await t.deps.db!.transaction((tx) => importStore(tx, readSeedDir(SEED)));
  resetLookupCache();
}

/** Make the current working copy the ACTIVE release, as if it had been built and published. */
export async function activateWorkingCopy(t: TestApp) {
  const db = t.deps.db!;
  await db.update(s.releases).set({ status: 'retired' }).where(eq(s.releases.status, 'active'));
  const store = snapshotStore(await exportStore(db), 'release');
  const [snap] = await db
    .insert(s.contentSnapshots)
    .values({ kind: 'release', sha256: crypto.createHash('sha256').update(JSON.stringify(store)).digest('hex'), store, entityRevisions: {}, translations: {} })
    .returning();
  await db.insert(s.releases).values({ key: `R-TEST-${crypto.randomBytes(4).toString('hex')}`, kind: 'release', status: 'active', snapshotId: snap!.id });
}
