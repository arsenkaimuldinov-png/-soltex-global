/**
 * Content build step (runs before every dev server start, type check and production build).
 *
 *   1. Load the content store from the configured source (CONTENT_SOURCE, default "seed").
 *   2. Validate it — the build FAILS on: duplicate IDs/slugs, broken relations, unknown media,
 *      missing English text, placeholder mismatches between languages, missing UI keys.
 *      Outdated translations (English changed after approval) are reported as warnings.
 *   3. Write one resolved snapshot per language to src/content/snapshot/<locale>.json.
 *
 * The production frontend only ever reads these snapshots; it never calls a CMS at run time.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LOCALES } from '../../src/i18n/config';
import { isLocalized, Localized, TRANSLATED_LOCALES } from '../../src/content/locale';
import { resolveSnapshot } from '../../src/content/normalize';
import type { ContentSource } from '../../src/content/source';
import type { ContentStore } from '../../src/content/types';
import { seedContentSource } from '../../src/content/sources/seed';
import { fileContentSource } from '../../src/content/sources/file';
import { sourceHash } from './lib/source-hash';

const ROOT = path.resolve(import.meta.dirname, '../..');

const SOURCES: Record<string, ContentSource> = { seed: seedContentSource, file: fileContentSource };

const errors: string[] = [];
const warnings: string[] = [];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

/** Walk every value of a record, reporting Localized / MediaRef problems with a readable path. */
function walk(value: unknown, where: string, store: ContentStore, mediaIds: Set<string>) {
  if (isLocalized(value)) {
    const v = value as Localized;
    if (!v.en.trim()) errors.push(`${where}: empty English text`);
    const ph = placeholders(v.en);
    for (const l of TRANSLATED_LOCALES) {
      if (placeholders(v[l]) !== ph) errors.push(`${where} [${l}]: placeholders {${placeholders(v[l])}} differ from English {${ph}}`);
    }
    return;
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && 'mediaId' in value && Object.keys(value).length === 1) {
    const id = (value as { mediaId: string }).mediaId;
    if (!mediaIds.has(id)) errors.push(`${where}: unknown media "${id}"`);
    return;
  }
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${where}[${i}]`, store, mediaIds));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (k !== 'translationStatus') walk(v, `${where}.${k}`, store, mediaIds);
}

function validate(store: ContentStore) {
  const mediaIds = new Set(store.media.map((m) => m.id));
  const collections = {
    pages: store.pages,
    projects: store.projects,
    technologies: store.technologies,
    products: store.products,
    epcmStages: store.epcmStages,
    patents: store.patents,
    videos: store.videos,
  } as const;

  // unique IDs across the whole store
  const ids = new Map<string, string>();
  for (const [name, items] of Object.entries(collections)) {
    for (const item of items as { id: string }[]) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) errors.push(`${name}: invalid id "${item.id}"`);
      if (ids.has(item.id)) errors.push(`duplicate id "${item.id}" (${ids.get(item.id)} and ${name})`);
      ids.set(item.id, name);
    }
  }
  // unique slugs per routable collection
  for (const name of ['projects', 'technologies', 'products'] as const) {
    const seen = new Set<string>();
    for (const item of collections[name]) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug)) errors.push(`${name}: invalid slug "${item.slug}"`);
      if (seen.has(item.slug)) errors.push(`${name}: duplicate slug "${item.slug}"`);
      seen.add(item.slug);
    }
  }
  const pageKeys = new Set<string>();
  for (const p of store.pages) {
    if (pageKeys.has(p.key)) errors.push(`pages: duplicate key "${p.key}"`);
    pageKeys.add(p.key);
  }

  // relations
  const has = (coll: { id: string; status: string }[], id: string) => coll.some((x) => x.id === id && x.status === 'published');
  for (const p of store.projects)
    if (!has(store.technologies, p.relatedTechnologyId)) errors.push(`${p.id}.relatedTechnologyId → "${p.relatedTechnologyId}" not found/published`);
  for (const t of store.technologies)
    for (const id of t.relatedProjectIds) if (!has(store.projects, id)) errors.push(`${t.id}.relatedProjectIds → "${id}" not found/published`);
  for (const p of store.products) {
    if (!has(store.technologies, p.relatedTechnologyId)) errors.push(`${p.id}.relatedTechnologyId → "${p.relatedTechnologyId}" not found/published`);
    if (!has(store.projects, p.relatedProjectId)) errors.push(`${p.id}.relatedProjectId → "${p.relatedProjectId}" not found/published`);
  }

  // text + media, translation freshness
  const all: { id: string; translationStatus?: Record<string, { status: string; approvedSourceHash: string | null }> }[] = [
    ...Object.values(collections).flat(),
    store.settings,
  ];
  for (const item of all) {
    walk(item, item.id, store, mediaIds);
    const hash = sourceHash(item);
    for (const l of TRANSLATED_LOCALES) {
      const st = item.translationStatus?.[l];
      if (!st) errors.push(`${item.id}: missing translationStatus.${l}`);
      else if (st.status === 'approved' && st.approvedSourceHash !== hash)
        warnings.push(`${item.id} [${l}]: translation approved for an older English version (outdated)`);
    }
  }

  // redirects
  for (const r of store.redirects) {
    if (!r.from.startsWith('/') || !r.to.startsWith('/')) errors.push(`redirect ${r.id}: paths must start with "/"`);
    if (r.from === r.to) errors.push(`redirect ${r.id}: redirects to itself`);
  }
}

function validateUi() {
  const dir = path.join(ROOT, 'src/i18n/ui');
  const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')) as Record<string, string>;
  for (const l of TRANSLATED_LOCALES) {
    const dict = JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')) as Record<string, string>;
    for (const key of Object.keys(en)) {
      if (typeof dict[key] !== 'string' || !dict[key].trim()) errors.push(`UI key "${key}" missing in ${l}.json`);
      else if (placeholders(dict[key]) !== placeholders(en[key])) errors.push(`UI key "${key}" [${l}]: placeholder mismatch`);
    }
    for (const key of Object.keys(dict)) if (!(key in en)) errors.push(`UI key "${key}" in ${l}.json does not exist in en.json`);
  }
}

/**
 * Architecture guard: rendered code must read content through the content layer only.
 * (Unused legacy components excluded in tsconfig.json are skipped.)
 */
function validateArchitecture() {
  const tsconfig = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8');
  const excluded = new Set([...tsconfig.matchAll(/"(src\/[A-Za-z0-9/_-]+\.tsx?)"/g)].map((m) => m[1]));
  const forbidden: [RegExp, string][] = [
    [/from\s+['"][^'"]*\/data\/(?:pagesData|soltexData)['"]/, 'imports legacy src/data (use useContent())'],
    [/from\s+['"][^'"]*(?:i18n\/|\.\/)locales\/[^'"]*['"]|import\(['"][^'"]*locales\//, 'imports legacy English-keyed dictionaries'],
    [/from\s+['"][^'"]*content\/seed\/[^'"]*['"]/, 'imports the content seed directly (use useContent())'],
  ];
  for (const dir of ['src/components', 'src/pages', 'src/i18n', 'src/motion', 'src/services']) {
    for (const file of fs.readdirSync(path.join(ROOT, dir), { recursive: true }) as string[]) {
      const rel = `${dir}/${file}`;
      if (!/\.(tsx?|jsx?)$/.test(rel) || excluded.has(rel)) continue;
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const [re, msg] of forbidden) if (re.test(text)) errors.push(`${rel}: ${msg}`);
    }
  }
}

const sourceName = process.env.CONTENT_SOURCE || 'seed';
const source = SOURCES[sourceName];
if (!source) {
  console.error(`content: unknown CONTENT_SOURCE "${sourceName}" (available: ${Object.keys(SOURCES).join(', ')})`);
  process.exit(1);
}

const store = await source.loadStore();
validate(store);
validateUi();
validateArchitecture();

if (errors.length) {
  console.error(`content: ${errors.length} error(s)\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

const outDir = path.join(ROOT, 'src/content/snapshot');
fs.mkdirSync(outDir, { recursive: true });
for (const l of LOCALES) {
  const snapshot = resolveSnapshot(store, l.code);
  fs.writeFileSync(path.join(outDir, `${l.code}.json`), JSON.stringify(snapshot) + '\n');
}
if (warnings.length) console.warn(`content: ${warnings.length} warning(s)\n  - ${warnings.join('\n  - ')}`);
console.log(`content: source "${source.name}" → ${LOCALES.length} snapshots (${store.pages.length} pages, ${store.projects.length} projects, ${store.technologies.length} technologies, ${store.products.length} products)`);
