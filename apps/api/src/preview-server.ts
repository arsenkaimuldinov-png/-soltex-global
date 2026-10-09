/**
 * Preview server process (Phase G, docs/admin-publishing.md §7):
 *   DATABASE_URL=… RELEASES_DIR=… PREVIEW_ORIGIN=… PREVIEW_PORT=3102 npm run preview-server -w @soltex/api
 * Listens on loopback; nginx exposes it as the preview origin only.
 */
import { loadConfig } from './config.ts';
import { connect } from './db/client.ts';
import { UnconfiguredNotifier } from './notify/notifier.ts';
import { createPreviewServer } from './preview/server.ts';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('preview-server: DATABASE_URL is not set');
const database = connect(config.databaseUrl, 3);
const port = Number(process.env.PREVIEW_PORT ?? 3102);
const server = createPreviewServer(
  { config, db: database.db, now: () => new Date(), notifier: new UnconfiguredNotifier(console) },
  { log: config.logLevel === 'silent' ? undefined : (line) => console.log(`preview: ${line}`) }
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close(() => void database.close().then(() => process.exit(0))));
server.listen(port, config.host, () => console.log(`preview: http://${config.host}:${port} (origin ${config.publishing.previewOrigin})`));
