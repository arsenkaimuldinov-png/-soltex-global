/**
 * normalize: stored multilingual content (ContentStore) → resolved content for ONE language
 * (ContentSnapshot).
 *
 * Pure and framework-free. Used at build time by scripts/content/build-snapshots.ts; a future
 * custom-admin content source produces the same ContentStore shape and reuses this function,
 * so components never change when the source of content changes.
 *
 * Rules
 *  - Only `published` entities are included.
 *  - An entity is rendered in language L only if its translation for L is `approved`;
 *    otherwise the whole entity falls back to English (`contentLocale: 'en'`), never a mix.
 *  - `MediaRef` → `MediaAsset` with the URL resolved against the media base URL.
 */
import { DEFAULT_LOCALE, LOCALE_CODES, Locale, Localized, TranslatedLocale, isLocalized } from './locale';
import type {
  ContentSnapshot,
  ContentStore,
  MediaAsset,
  MediaRecord,
  MediaRef,
  Resolved,
  ResolvedMeta,
  TranslationStatus,
} from './types';
import { resolveMediaUrl } from './media';

const isMediaRef = (value: unknown): value is MediaRef =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  typeof (value as MediaRef).mediaId === 'string';

export class ContentResolveError extends Error {}

function resolveValue(
  value: unknown,
  locale: Locale,
  media: Map<string, MediaRecord>,
  mediaLocale: Locale
): unknown {
  if (isLocalized(value)) return (value as Localized)[locale];
  if (isMediaRef(value)) return resolveMedia(value, media, mediaLocale);
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, locale, media, mediaLocale));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'translationStatus') continue;
      out[k] = resolveValue(v, locale, media, mediaLocale);
    }
    return out;
  }
  return value;
}

function resolveMedia(ref: MediaRef, media: Map<string, MediaRecord>, locale: Locale): MediaAsset {
  const rec = media.get(ref.mediaId);
  if (!rec) throw new ContentResolveError(`Unknown media id "${ref.mediaId}"`);
  return {
    id: rec.id,
    kind: rec.kind,
    src: resolveMediaUrl(rec.src),
    width: rec.width,
    height: rec.height,
    alt: rec.alt ? rec.alt[locale] : null,
  };
}

/** The language an entity is rendered in for the requested locale. */
export function effectiveLocale(status: TranslationStatus | undefined, locale: Locale): Locale {
  if (locale === DEFAULT_LOCALE || !status) return locale;
  return status[locale as TranslatedLocale]?.status === 'approved' ? locale : DEFAULT_LOCALE;
}

function resolveEntity<T extends { translationStatus?: TranslationStatus }>(
  record: T,
  locale: Locale,
  media: Map<string, MediaRecord>
): Resolved<T> & ResolvedMeta {
  const contentLocale = effectiveLocale(record.translationStatus, locale);
  const resolved = resolveValue(record, contentLocale, media, contentLocale) as Resolved<T>;
  const availableLocales = LOCALE_CODES.filter((l) => effectiveLocale(record.translationStatus, l) === l);
  return { ...resolved, contentLocale, availableLocales };
}

const published = <T extends { status: string }>(items: T[]) => items.filter((i) => i.status === 'published');
const byOrder = <T extends { order: number }>(items: T[]) => [...items].sort((a, b) => a.order - b.order);

export function resolveSnapshot(store: ContentStore, locale: Locale): ContentSnapshot {
  const media = new Map(store.media.map((m) => [m.id, m]));
  const all = <T extends { status: string; order: number; translationStatus?: TranslationStatus }>(items: T[]) =>
    byOrder(published(items)).map((i) => resolveEntity(i, locale, media));

  return {
    locale,
    pages: all(store.pages),
    projects: all(store.projects),
    technologies: all(store.technologies),
    products: all(store.products),
    epcmStages: all(store.epcmStages),
    patents: all(store.patents),
    videos: all(store.videos),
    settings: resolveEntity(store.settings, locale, media),
    redirects: store.redirects,
  };
}
