/**
 * Make every missing responsive copy now (Phase J-2), e.g. right after deployment or an import:
 *   DATABASE_URL=… MEDIA_DIR=… npm run media:variants -w @soltex/api
 * The publishing worker does the same in the background, one image at a time.
 */
import path from 'node:path';
import { mediaConfig, type ApiConfig, type AppEnv } from '../config.ts';
import { connect } from '../db/client.ts';
import { UnconfiguredNotifier } from '../notify/notifier.ts';
import { generateAllVariants } from '../media/variants.ts';

// Only the database and the media directories are needed (no keys, no origins).
const env = (process.env.NODE_ENV ?? 'development') as AppEnv;
const releasesDir = path.resolve(process.env.RELEASES_DIR ?? '/srv/soltex');
const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl) throw new Error('media:variants: DATABASE_URL is not set');
const config = { env, databaseUrl, media: mediaConfig(process.env, env, releasesDir) } as ApiConfig;
const database = connect(databaseUrl, 2);
try {
  const n = await generateAllVariants({ config, db: database.db, now: () => new Date(), notifier: new UnconfiguredNotifier(console) });
  console.log(`media:variants: ${n} image(s) handled; copies in ${config.media.dir}/variants`);
} finally {
  await database.close();
}
