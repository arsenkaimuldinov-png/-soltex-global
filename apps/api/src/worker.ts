/**
 * Publishing worker process (Phase G): builds queued releases one at a time; also makes image
 * copies (J-2), sends e-mail from the outbox and anonymizes due leads (K-1)
 * (docs/admin-publishing.md §5). Runs next to the API from the same codebase (approved ADR-01):
 *   DATABASE_URL=… RELEASES_DIR=… npm run worker -w @soltex/api
 */
import { loadConfig } from './config.ts';
import { connect } from './db/client.ts';
import { UnconfiguredNotifier } from './notify/notifier.ts';
import { siteBuildEnv, siteBuilder } from './publishing/builder.ts';
import { workerLoop } from './publishing/worker.ts';
import { emailProviderFor } from './notify/email.ts';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('worker: DATABASE_URL is not set');
const database = connect(config.databaseUrl, 3);
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => controller.abort());
console.log(`worker: building releases into ${config.publishing.releasesDir}`);
await workerLoop({ config, db: database.db, now: () => new Date(), notifier: new UnconfiguredNotifier(console) }, siteBuilder({ mediaDir: config.media.dir, siteEnv: siteBuildEnv(config) }), controller.signal, 2000, emailProviderFor(config));
await database.close();
