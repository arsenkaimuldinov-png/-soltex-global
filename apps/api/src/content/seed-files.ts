/**
 * The seed format: the content store as ten JSON files (apps/web/src/content/seed), each
 * formatted with JSON.stringify(value, null, 2) + "\n". Export writes the same files, so a
 * database export can be compared with the seed byte for byte.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ContentStore } from '@soltex/core/content';

export const SEED_FILES = {
  pages: 'pages.json',
  projects: 'projects.json',
  technologies: 'technologies.json',
  products: 'products.json',
  epcmStages: 'epcm-stages.json',
  patents: 'patents.json',
  videos: 'videos.json',
  media: 'media.json',
  settings: 'settings.json',
  redirects: 'redirects.json',
} as const satisfies Record<keyof ContentStore, string>;

export const serialize = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

export function readSeedDir(dir: string): ContentStore {
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as unknown;
  return Object.fromEntries(Object.entries(SEED_FILES).map(([k, f]) => [k, read(f)])) as unknown as ContentStore;
}

export function writeSeedDir(store: ContentStore, dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  for (const [k, f] of Object.entries(SEED_FILES)) {
    fs.writeFileSync(path.join(dir, f), serialize(store[k as keyof ContentStore]));
  }
}
