/**
 * File content source: a complete ContentStore in one JSON file, e.g. the export of the
 * admin database (`npm run db:export -w @soltex/api -- --file <store.json>`).
 *
 *   CONTENT_SOURCE=file CONTENT_STORE_FILE=/path/to/store.json npm run build
 *
 * Build-time only (Node); the site never reads content at run time.
 */
import fs from 'node:fs';
import type { ContentSource } from '../source';
import type { ContentStore } from '../types';

export const fileContentSource: ContentSource = {
  name: 'file',
  async loadStore(): Promise<ContentStore> {
    const file = process.env.CONTENT_STORE_FILE;
    if (!file) throw new Error('CONTENT_SOURCE=file needs CONTENT_STORE_FILE (path to a content store JSON file)');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ContentStore;
  },
};
