/**
 * SEO checker (Phase I-1, approved §14): one pure function shared by the site build, the API and
 * the admin. Input is a content store in the stored (multilingual) shape; the caller decides which
 * records count as published (the next release, or "this record if it were published").
 *
 *   BLOCKING  publishing / release creation / the build are refused
 *   WARNING   allowed, shown in the SEO block and the SEO overview
 *   INFO      hints
 *
 * Layer rule: the seo layer may not import the content layer, so the store is described here
 * structurally (only the fields the checks read); ContentStore satisfies it.
 */
import { CONTENT_LOCALES, type Locale } from '../domain/locales.ts';
import { MEDIA_LARGE_IMAGE_BYTES } from '../domain/media.ts';
import { DETAIL_PATH_PREFIX, NAVIGATION_PAGES, PAGE_ROUTES, PAGE_ROUTE_PATHS, type PageRouteKey, type RoutableCollection, SEO_TITLE_HARD_MAX, seoDefaults } from './meta.ts';
import { SEO_DESCRIPTION_RECOMMENDED_MAX, SEO_DESCRIPTION_RECOMMENDED_MIN, SEO_TITLE_RECOMMENDED_MAX } from './limits.ts';
import { buildRedirectIndex, expandRedirect, REDIRECT_MAX_HOPS, redirectPathProblem, splitLocale, type RedirectRule } from './redirects.ts';
import { slugProblem } from './slug.ts';

/** Social networks show sharp previews from 1200 px wide (Open Graph). */
export const OG_IMAGE_MIN_WIDTH = 1200;

// ---------------------------------------------------------------------------
// Input (structural)
// ---------------------------------------------------------------------------

type Loc = Readonly<Record<Locale, string>>;

interface SeoFields {
  metaTitle: Loc | null;
  metaDescription: Loc | null;
  ogImage: { mediaId: string } | null;
  noindex: boolean;
}

interface Base {
  id: string;
  status: string;
  translationStatus?: Readonly<Partial<Record<string, { status: string }>>>;
}

export interface SeoCheckStore {
  pages: ReadonlyArray<
    Base & {
      key: string;
      kind: string;
      header: { title: Loc; description: Loc | null } | null;
      lists: Readonly<Record<string, ReadonlyArray<unknown>>>;
      seo: SeoFields | null;
    }
  >;
  projects: ReadonlyArray<Base & { slug: string; title: Loc; overview: Loc; seo: SeoFields; relatedTechnologyId: string }>;
  technologies: ReadonlyArray<Base & { slug: string; title: Loc; overview: Loc; seo: SeoFields; relatedProjectIds: readonly string[] }>;
  products: ReadonlyArray<Base & { slug: string; title: Loc; description: Loc; seo: SeoFields; relatedTechnologyId: string; relatedProjectId: string }>;
  epcmStages: ReadonlyArray<Base>;
  patents: ReadonlyArray<Base>;
  videos: ReadonlyArray<Base>;
  media: ReadonlyArray<{ id: string; kind?: string; width?: number | null; variants?: ReadonlyArray<unknown> }>;
  redirects: ReadonlyArray<RedirectRule>;
}

/** Entity types as named by the API and the admin. */
export type SeoEntityType = 'pages' | 'projects' | 'technologies' | 'products' | 'epcm-stages' | 'patents' | 'videos';

/** Effective state of a translation (the API knows "outdated"; the stored status alone does not). */
export type SeoTranslationState = 'approved' | 'outdated' | 'in_progress' | 'missing';

export interface SeoCheckOptions {
  /** File size of a media entry (the API knows it; the build does not, and then skips the size check). */
  mediaBytes?: (mediaKey: string) => number | null;
  /** Translation state of (type, key, language); default: the stored status. */
  translationState?: (type: SeoEntityType, key: string, locale: Exclude<Locale, 'en'>) => SeoTranslationState;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export const SEO_SEVERITIES = ['blocking', 'warning', 'info'] as const;
export type SeoSeverity = (typeof SEO_SEVERITIES)[number];

export const SEO_ISSUE_SEVERITY = {
  slug_invalid: 'blocking',
  slug_duplicate: 'blocking',
  relation_broken: 'blocking',
  media_missing: 'blocking',
  link_broken: 'blocking',
  title_missing: 'blocking',
  description_missing: 'blocking',
  title_too_long: 'blocking',
  redirect_invalid: 'blocking',
  redirect_self: 'blocking',
  redirect_duplicate: 'blocking',
  redirect_loop: 'blocking',
  redirect_shadows_page: 'blocking',
  redirect_target_missing: 'blocking',
  title_length: 'warning',
  description_length: 'warning',
  title_duplicate: 'warning',
  description_duplicate: 'warning',
  translation_missing: 'warning',
  translation_outdated: 'warning',
  og_image_missing: 'warning',
  noindex_in_navigation: 'warning',
  image_too_large: 'warning',
  og_image_small: 'warning',
  redirect_chain: 'warning',
  title_default: 'info',
  description_default: 'info',
} as const satisfies Record<string, SeoSeverity>;

export type SeoIssueCode = keyof typeof SEO_ISSUE_SEVERITY;
export const SEO_ISSUE_CODES = Object.keys(SEO_ISSUE_SEVERITY) as SeoIssueCode[];

export interface SeoIssue {
  code: SeoIssueCode;
  severity: SeoSeverity;
  /** `redirects` for redirect rules, otherwise the entity type. */
  type: SeoEntityType | 'redirects';
  /** Entity key (stored id) or redirect id. */
  key: string;
  /** Language the issue is about; null = all languages / language-independent. */
  locale: Locale | null;
  /** Editor field the issue points to (admin field name), when there is one. */
  field: string | null;
  params: Record<string, string | number>;
}

/** Effective SEO of one public page in one language, as the site renders it. */
export interface SeoPageMeta {
  type: 'pages' | RoutableCollection;
  key: string;
  /** Locale-less path, e.g. "/projects/solbar-israel". */
  path: string;
  locale: Locale;
  /** Language the content is served in (English when the translation is not approved). */
  servedLocale: Locale;
  title: string;
  description: string;
  titleSource: 'override' | 'default';
  descriptionSource: 'override' | 'default';
  indexable: boolean;
}

export interface SeoReport {
  issues: SeoIssue[];
  pages: SeoPageMeta[];
  summary: Record<SeoSeverity, number>;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const published = <T extends { status: string }>(items: ReadonlyArray<T>) => items.filter((i) => i.status === 'published');

const SLUG_TYPE = { technologies: 'technology', products: 'product', projects: 'project' } as const;

interface Doc {
  type: 'pages' | RoutableCollection;
  key: string;
  path: string;
  heading: Loc | null;
  text: Loc | null;
  seo: SeoFields | null;
  translationStatus?: Base['translationStatus'];
  pageKey?: PageRouteKey;
}

function storedState(rec: { translationStatus?: Base['translationStatus'] }, locale: Exclude<Locale, 'en'>): SeoTranslationState {
  const s = rec.translationStatus?.[locale]?.status;
  return s === 'approved' || s === 'in_progress' ? s : 'missing';
}

/** Walk every `{ mediaId }` reference of a record with its field path. */
function mediaRefs(value: unknown, path: string, out: Array<{ field: string; id: string }>) {
  if (Array.isArray(value)) value.forEach((v, i) => mediaRefs(v, `${path}.${i}`, out));
  else if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'mediaId' && typeof (value as { mediaId: unknown }).mediaId === 'string') {
      out.push({ field: path, id: (value as { mediaId: string }).mediaId });
      return;
    }
    for (const [k, v] of Object.entries(value)) if (k !== 'translationStatus') mediaRefs(v, path ? `${path}.${k}` : k, out);
  }
}

/** Internal links (`href` values starting with "/") of page lists. */
function listLinks(lists: Readonly<Record<string, ReadonlyArray<unknown>>>): Array<{ field: string; href: string }> {
  const out: Array<{ field: string; href: string }> = [];
  for (const [name, items] of Object.entries(lists))
    items.forEach((item, i) => {
      if (item && typeof item === 'object')
        for (const [k, v] of Object.entries(item)) if (k === 'href' && typeof v === 'string' && v.startsWith('/')) out.push({ field: `lists.${name}.${i}.${k}`, href: v });
    });
  return out;
}

export function checkSeo(store: SeoCheckStore, options: SeoCheckOptions = {}): SeoReport {
  const issues: SeoIssue[] = [];
  const pages: SeoPageMeta[] = [];
  const add = (code: SeoIssueCode, type: SeoIssue['type'], key: string, locale: Locale | null, field: string | null, params: SeoIssue['params'] = {}) =>
    issues.push({ code, severity: SEO_ISSUE_SEVERITY[code], type, key, locale, field, params });
  const stateOf = (type: SeoEntityType, rec: Doc | (Base & { id: string }), key: string, locale: Exclude<Locale, 'en'>) =>
    options.translationState ? options.translationState(type, key, locale) : storedState(rec, locale);

  // Public documents ---------------------------------------------------------------------------
  const docs: Doc[] = [];
  const pageKeys = new Set(PAGE_ROUTES.map(([k]) => k as string));
  for (const p of published(store.pages))
    if (p.kind === 'page' && pageKeys.has(p.key))
      docs.push({ type: 'pages', key: p.id, path: PAGE_ROUTE_PATHS[p.key as PageRouteKey], heading: p.header?.title ?? null, text: p.header?.description ?? null, seo: p.seo, translationStatus: p.translationStatus, pageKey: p.key as PageRouteKey });
  for (const t of published(store.technologies)) docs.push({ type: 'technologies', key: t.id, path: DETAIL_PATH_PREFIX.technologies + t.slug, heading: t.title, text: t.overview, seo: t.seo, translationStatus: t.translationStatus });
  for (const p of published(store.products)) docs.push({ type: 'products', key: p.id, path: DETAIL_PATH_PREFIX.products + p.slug, heading: p.title, text: p.description, seo: p.seo, translationStatus: p.translationStatus });
  for (const p of published(store.projects)) docs.push({ type: 'projects', key: p.id, path: DETAIL_PATH_PREFIX.projects + p.slug, heading: p.title, text: p.overview, seo: p.seo, translationStatus: p.translationStatus });
  const livePaths = new Set(docs.map((d) => d.path));

  // Slugs --------------------------------------------------------------------------------------
  for (const coll of ['technologies', 'products', 'projects'] as const) {
    const seen = new Map<string, string>();
    for (const r of published<Base & { slug: string }>(store[coll])) {
      const problem = slugProblem(SLUG_TYPE[coll], r.slug);
      if (problem) add('slug_invalid', coll, r.id, null, 'slug', { problem });
      const other = seen.get(r.slug);
      if (other) add('slug_duplicate', coll, r.id, null, 'slug', { slug: r.slug, other });
      else seen.set(r.slug, r.id);
    }
  }

  // Relations and media ------------------------------------------------------------------------
  const live = (items: ReadonlyArray<Base>) => new Set(published(items).map((i) => i.id));
  const liveTech = live(store.technologies);
  const liveProjects = live(store.projects);
  for (const p of published(store.projects))
    if (!liveTech.has(p.relatedTechnologyId)) add('relation_broken', 'projects', p.id, null, 'relatedTechnology', { target: p.relatedTechnologyId });
  for (const t of published(store.technologies))
    for (const id of t.relatedProjectIds) if (!liveProjects.has(id)) add('relation_broken', 'technologies', t.id, null, 'relatedProjects', { target: id });
  for (const p of published(store.products)) {
    if (!liveTech.has(p.relatedTechnologyId)) add('relation_broken', 'products', p.id, null, 'relatedTechnology', { target: p.relatedTechnologyId });
    if (!liveProjects.has(p.relatedProjectId)) add('relation_broken', 'products', p.id, null, 'relatedProject', { target: p.relatedProjectId });
  }
  const mediaById = new Map(store.media.map((m) => [m.id, m]));
  const collections: Array<[SeoEntityType, ReadonlyArray<Base>]> = [
    ['pages', store.pages],
    ['projects', store.projects],
    ['technologies', store.technologies],
    ['products', store.products],
    ['epcm-stages', store.epcmStages],
    ['patents', store.patents],
    ['videos', store.videos],
  ];
  for (const [type, items] of collections)
    for (const r of published(items)) {
      const refs: Array<{ field: string; id: string }> = [];
      mediaRefs(r, '', refs);
      for (const ref of refs) {
        const field = ref.field.split('.')[0] === 'seo' ? 'ogImage' : ref.field;
        const m = mediaById.get(ref.id);
        if (!m) {
          add('media_missing', type, r.id, null, field, { media: ref.id });
          continue;
        }
        if (m.kind === 'video') continue;
        // Phase J-2: a large original matters only while the site has no smaller copies to serve.
        const bytes = options.mediaBytes?.(m.id) ?? null;
        if (bytes !== null && bytes > MEDIA_LARGE_IMAGE_BYTES && !m.variants?.length) add('image_too_large', type, r.id, null, field, { media: m.id, bytes });
        if (field === 'ogImage' && m.width && m.width < OG_IMAGE_MIN_WIDTH) add('og_image_small', type, r.id, null, field, { media: m.id, width: m.width, min: OG_IMAGE_MIN_WIDTH });
      }
    }

  // Internal links of pages --------------------------------------------------------------------
  for (const p of published(store.pages))
    for (const l of listLinks(p.lists)) {
      const target = l.href.split(/[?#]/)[0]!.replace(/(.)\/+$/, '$1');
      if (!livePaths.has(target)) add('link_broken', 'pages', p.id, null, l.field, { href: l.href });
    }

  // Per document and language ------------------------------------------------------------------
  for (const d of docs) {
    const indexable = !(d.seo?.noindex ?? false);
    if (!d.seo?.metaTitle) add('title_default', d.type, d.key, null, 'seoMetaTitle');
    if (!d.seo?.metaDescription) add('description_default', d.type, d.key, null, 'seoMetaDescription');
    if (d.type !== 'pages' && !d.seo?.ogImage) add('og_image_missing', d.type, d.key, null, 'ogImage');
    if (!indexable && d.pageKey && NAVIGATION_PAGES.includes(d.pageKey)) add('noindex_in_navigation', d.type, d.key, null, 'noindex');
    for (const locale of CONTENT_LOCALES) {
      let served: Locale = locale;
      if (locale !== 'en') {
        const state = stateOf(d.type, d, d.key, locale);
        if (state === 'missing' || state === 'in_progress') add('translation_missing', d.type, d.key, locale, null, { state });
        else if (state === 'outdated') add('translation_outdated', d.type, d.key, locale, null);
        // The site serves a translation only when its stored status is approved (an outdated
        // translation keeps its previously approved text; otherwise English).
        if (storedState(d, locale) !== 'approved') served = 'en';
      }
      const defaults = seoDefaults(d.heading?.[served] ?? null, d.text?.[served] ?? null);
      const overrideTitle = d.seo?.metaTitle?.[served];
      const overrideDesc = d.seo?.metaDescription?.[served];
      const meta: SeoPageMeta = {
        type: d.type,
        key: d.key,
        path: d.path,
        locale,
        servedLocale: served,
        title: d.seo?.metaTitle ? overrideTitle ?? '' : defaults.title,
        description: d.seo?.metaDescription ? overrideDesc ?? '' : defaults.description,
        titleSource: d.seo?.metaTitle ? 'override' : 'default',
        descriptionSource: d.seo?.metaDescription ? 'override' : 'default',
        indexable,
      };
      pages.push(meta);
      if (!indexable || (locale !== 'en' && served !== locale)) continue; // fallback pages canonicalize to English
      const title = meta.title.trim();
      const description = meta.description.trim();
      if (!title) add('title_missing', d.type, d.key, locale, 'seoMetaTitle');
      else if (title.length > SEO_TITLE_HARD_MAX) add('title_too_long', d.type, d.key, locale, 'seoMetaTitle', { length: title.length, max: SEO_TITLE_HARD_MAX });
      else if (title.length > SEO_TITLE_RECOMMENDED_MAX) add('title_length', d.type, d.key, locale, 'seoMetaTitle', { length: title.length, max: SEO_TITLE_RECOMMENDED_MAX });
      if (!description) add('description_missing', d.type, d.key, locale, 'seoMetaDescription');
      else if (description.length < SEO_DESCRIPTION_RECOMMENDED_MIN || description.length > SEO_DESCRIPTION_RECOMMENDED_MAX)
        add('description_length', d.type, d.key, locale, 'seoMetaDescription', { length: description.length, min: SEO_DESCRIPTION_RECOMMENDED_MIN, max: SEO_DESCRIPTION_RECOMMENDED_MAX });
    }
  }

  // Duplicate titles / descriptions among indexable pages served in their own language ---------
  for (const locale of CONTENT_LOCALES) {
    const own = pages.filter((m) => m.locale === locale && m.indexable && m.servedLocale === locale);
    for (const [field, code, pick] of [
      ['seoMetaTitle', 'title_duplicate', (m: SeoPageMeta) => m.title.trim()],
      ['seoMetaDescription', 'description_duplicate', (m: SeoPageMeta) => m.description.trim()],
    ] as const) {
      const groups = new Map<string, SeoPageMeta[]>();
      for (const m of own) {
        const v = pick(m);
        if (v) groups.set(v, [...(groups.get(v) ?? []), m]);
      }
      for (const group of groups.values())
        if (group.length > 1) for (const m of group) add(code, m.type, m.key, locale, field, { count: group.length, with: group.filter((o) => o !== m).map((o) => o.path).join(', ') });
    }
  }

  // Redirects (Phase I-2: concrete paths per language, see ./redirects.ts) ----------------------
  // A path is live when its locale-less form is a public page: every page exists in every language.
  const isLive = (path: string) => livePaths.has(splitLocale(path).path);
  const valid: RedirectRule[] = [];
  for (const r of store.redirects) {
    const all = !!r.allLocales;
    const fromProblem = redirectPathProblem(r.from, 'from', all);
    const toProblem = redirectPathProblem(r.to, 'to', all);
    if (fromProblem || toProblem) {
      add('redirect_invalid', 'redirects', r.id, null, fromProblem ? 'from' : 'to', { problem: (fromProblem ?? toProblem)! });
      continue;
    }
    if (r.from === r.to) {
      add('redirect_self', 'redirects', r.id, null, 'to');
      continue;
    }
    valid.push(r);
  }
  const owner = new Map<string, string>();
  const duplicates: Array<[string, string]> = [];
  for (const r of valid)
    for (const c of expandRedirect(r)) {
      const first = owner.get(c.from);
      if (first === undefined) owner.set(c.from, r.id);
      else if (first !== r.id) duplicates.push([first, c.from], [r.id, c.from]);
    }
  for (const [id, path] of new Map(duplicates)) add('redirect_duplicate', 'redirects', id, null, 'from', { path });
  const index = buildRedirectIndex(valid);
  for (const r of valid) {
    const once = new Set<string>();
    const report = (code: SeoIssueCode, field: string, params: SeoIssue['params']) => {
      if (once.has(code)) return;
      once.add(code);
      add(code, 'redirects', r.id, null, field, params);
    };
    for (const c of expandRedirect(r)) {
      if (isLive(c.from)) report('redirect_shadows_page', 'from', { path: c.from });
      if (owner.get(c.from) !== r.id) continue;
      let to = c.to;
      let hops = 1;
      let loop = false;
      const seen = new Set([c.from]);
      while (index.has(to)) {
        if (seen.has(to) || hops >= REDIRECT_MAX_HOPS) {
          loop = true;
          break;
        }
        seen.add(to);
        to = index.get(to)!.to;
        hops++;
      }
      if (loop) report('redirect_loop', 'to', { path: c.from });
      else {
        if (hops > 1) report('redirect_chain', 'to', { hops, final: to });
        if (!isLive(to)) report('redirect_target_missing', 'to', { path: to });
      }
    }
  }

  const summary = { blocking: 0, warning: 0, info: 0 };
  for (const i of issues) summary[i.severity]++;
  return { issues, pages, summary };
}

/** Plain-English one-line description of an issue (build logs, API detail). The admin has its own Russian wording. */
export function formatSeoIssue(i: SeoIssue): string {
  const where = `${i.type}/${i.key}${i.locale ? ` [${i.locale}]` : ''}${i.field ? ` ${i.field}` : ''}`;
  const params = Object.entries(i.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  return `${i.severity.toUpperCase()} ${i.code}: ${where}${params ? ` (${params})` : ''}`;
}
