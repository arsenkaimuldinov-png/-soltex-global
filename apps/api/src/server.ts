import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { connect } from './db/client.ts';

const config = loadConfig();
const database = config.databaseUrl ? connect(config.databaseUrl, 10) : null;
if (!database) console.warn('DATABASE_URL is not set: only /api/v1/health will work');
const app = await buildApp({ config, db: database?.db ?? null });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(() => database?.close())
      .then(() => process.exit(0));
  });
}

await app.listen({ host: config.host, port: config.port });
