/**
 * Write the OpenAPI 3.1 document of /api/v1 to apps/api/openapi.json (committed; CI checks it is current).
 *   npm run openapi -w @soltex/api            write
 *   npm run openapi -w @soltex/api -- --check fail if the committed file is out of date
 * The document is generated from the route schemas; no database or secrets are needed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildApp } from '../app.ts';
import { loadConfig } from '../config.ts';

const target = path.resolve(import.meta.dirname, '../../openapi.json');
const app = await buildApp({ config: loadConfig({ NODE_ENV: 'test' }) });
await app.ready();
const doc = `${JSON.stringify(app.swagger(), null, 2)}\n`;
await app.close();

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== doc) {
    console.error('openapi.json is out of date — run `npm run openapi -w @soltex/api` and commit the result');
    process.exit(1);
  }
  console.log('openapi.json is up to date');
} else {
  await writeFile(target, doc);
  console.log(`openapi: wrote ${path.relative(process.cwd(), target)}`);
}
