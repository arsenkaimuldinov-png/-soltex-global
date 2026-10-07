/**
 * Content sources.
 *
 * Content flows in two stages:
 *
 *   1. BUILD TIME — a `ContentSource` returns the complete multilingual `ContentStore`.
 *      `seedContentSource` (JSON files in src/content/seed/) or `fileContentSource` (one
 *      ContentStore JSON file, e.g. the export of the admin database — Phase B).
 *      scripts/content/build-snapshots.ts validates the store and writes one resolved
 *      `ContentSnapshot` per language to src/content/snapshot/<locale>.json.
 *
 *   2. RUN TIME — the app loads the snapshot of the current language (see src/i18n/bundles.ts).
 *      The production site never calls a CMS/API at run time, so it stays fully static and
 *      independent of the backend's availability.
 *
 * Selecting a source: CONTENT_SOURCE environment variable at build time: "seed" (default) or
 * "file" (with CONTENT_STORE_FILE).
 */
import type { ContentStore } from './types';

export interface ContentSource {
  /** Identifier used in build logs. */
  readonly name: string;
  /** Load every content entity in stored (multilingual) form. */
  loadStore(): Promise<ContentStore>;
}
