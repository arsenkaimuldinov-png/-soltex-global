/**
 * Seed-format source hash (`translationStatus.<l>.approvedSourceHash`): sha256 of the ENGLISH
 * projection of a whole store record, first 16 hex characters. Same algorithm as the site build
 * validator (apps/web/scripts/content/lib/source-hash.ts), which warns about approved translations
 * whose hash differs; apps cannot import each other, so it is repeated here and a test checks it
 * against every approved translation of the seed.
 *
 * It covers the whole record (also order, status, images), so the CMS does not use it to decide
 * "outdated" — that is the source revision (docs/admin-translations.md §2). It is used only
 *  - to link approvals that come from the seed / an export to the database revision (reconcile.ts);
 *  - to write the seed-format hash of current approvals in the export.
 */
import { createHash } from 'node:crypto';
import { isLocalized } from '@soltex/core/content';

function englishProjection(value: unknown): unknown {
  if (isLocalized(value)) return value.en;
  if (Array.isArray(value)) return value.map(englishProjection);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'translationStatus') continue;
      out[key] = englishProjection((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function legacySourceHash(record: unknown): string {
  return createHash('sha256').update(JSON.stringify(englishProjection(record))).digest('hex').slice(0, 16);
}
