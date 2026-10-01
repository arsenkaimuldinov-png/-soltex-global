/**
 * Source hash of an entity: a hash of its ENGLISH text only. Stored as
 * translationStatus.<locale>.approvedSourceHash when a translation is approved; when the
 * English text later changes, the hashes differ and the translation is reported as outdated.
 */
import { createHash } from 'node:crypto';
import { isLocalized } from '../../../src/content/locale';

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

export function sourceHash(record: unknown): string {
  return createHash('sha256').update(JSON.stringify(englishProjection(record))).digest('hex').slice(0, 16);
}
