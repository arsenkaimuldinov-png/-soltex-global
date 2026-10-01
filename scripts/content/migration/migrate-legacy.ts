/**
 * ONE-OFF MIGRATION (Phase 1): legacy hard-coded/localized content → content seed + UI keys.
 *
 * Inputs (all pre-Phase-1 sources, kept unchanged for traceability):
 *   - src/data/pagesData.ts, src/data/soltexData.ts        approved entity data (English)
 *   - scripts/content/migration/legacy-inline.ts            content that was inline in components
 *   - scripts/content/migration/copy-map.json               stable key → English text (written by
 *                                                           the Phase 1 codemod, one entry per
 *                                                           replaced t('English text') call)
 *   - src/i18n/locales/{ru,zh,tr,ar,es}.json                legacy dictionaries keyed by English
 *
 * Outputs:
 *   - src/content/seed/*.json     multilingual content store (source of truth from now on)
 *   - src/i18n/ui/<locale>.json   UI strings with stable keys
 *
 * Each translated value is resolved EXACTLY like the legacy runtime did
 * (`dictionary[english] ?? english`), so every page renders the same text as before.
 *
 * Run: npx tsx scripts/content/migration/migrate-legacy.ts
 * After migration the seed is edited directly (later: through the custom admin); re-running
 * this script would overwrite those edits.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LOCALES, Locale } from '../../../src/i18n/config';
import type {
  EpcmStageRecord,
  GlobalSettingsRecord,
  MediaRecord,
  MediaRef,
  PageRecord,
  PatentRecord,
  ProductRecord,
  ProjectRecord,
  SeoRecord,
  TechnologyRecord,
  TranslationStatus,
  VideoRecord,
  PageKey,
  PageHeaderRecord,
} from '../../../src/content/types';
import { TRANSLATED_LOCALES, type Localized } from '../../../src/content/locale';
import { sourceHash } from '../lib/source-hash';
import { PROJECTS_DATA, TECHNOLOGIES_DATA, PRODUCTS_DATA, GLOBAL_OFFICES, PATENTS_DATA, COMPANY_TIMELINE } from '../../../src/data/pagesData';
import { HERO_DATA, KEY_DIRECTIONS, COMPANY_VIDEOS, EPCM_STAGES } from '../../../src/data/soltexData';
import {
  COMPANY_CAPABILITIES,
  EPCM_STAGE_IMAGES,
  HOME_DESCRIPTION,
  HOME_PATENT_CARDS,
  HOME_PATENT_IDS,
  HOME_TITLE,
  METRICS,
  PAGE_MEDIA,
  PATENT_IMAGERY,
  REGISTRY_PATENT_IDS,
  SETTINGS_TEXT,
  TEMPLATE_MEDIA,
} from './legacy-inline';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const MIGRATED_AT = '2026-10-01';

// ---------------------------------------------------------------------------
// Legacy dictionaries → Localized values
// ---------------------------------------------------------------------------
const dictionaries = Object.fromEntries(
  LOCALES.filter((l) => l.code !== 'en').map((l) => [
    l.code,
    JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l.code}.json`), 'utf8')) as Record<string, string>,
  ])
) as Record<Exclude<Locale, 'en'>, Record<string, string>>;

const usedLegacyKeys = new Set<string>();
const untranslated: Record<string, string[]> = {};

/** Translatable text: exactly what the legacy `t(english)` returned in each language. */
function L(en: string): Localized {
  usedLegacyKeys.add(en);
  const out = { en } as Localized;
  for (const loc of TRANSLATED_LOCALES) {
    const hit = dictionaries[loc][en];
    if (hit === undefined && /[A-Za-z]/.test(en)) (untranslated[loc] ??= []).push(en);
    out[loc] = hit ?? en;
  }
  return out;
}
const Lopt = (en: string | undefined | null) => (en ? L(en) : null);
const Llist = (items: string[]) => items.map(L);

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------
const media = new Map<string, MediaRecord>();

function mediaIdFor(src: string): string {
  const base = path.basename(src).replace(/\.[a-z0-9]+$/i, '');
  const folder = path.dirname(src).split('/').filter(Boolean).slice(1).join('-'); // e.g. "projects"
  return `media-${folder ? folder + '-' : ''}${base}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

function M(src: string): MediaRef {
  const id = mediaIdFor(src);
  if (!media.has(id)) {
    media.set(id, {
      id,
      kind: /\.(mp4|webm|mov)$/i.test(src) ? 'video' : 'image',
      src,
      width: null,
      height: null,
      alt: null,
    });
  }
  return { mediaId: id };
}

async function measureMedia() {
  for (const m of media.values()) {
    if (m.kind !== 'image') continue;
    const file = path.join(ROOT, 'public', m.src);
    if (!fs.existsSync(file)) throw new Error(`Missing media file ${m.src}`);
    const meta = await sharp(file).metadata();
    m.width = meta.width ?? null;
    m.height = meta.height ?? null;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const NO_SEO: SeoRecord = { metaTitle: null, metaDescription: null, ogImage: null, noindex: false };

/** All existing translations are the approved baseline. */
function approved<T extends object>(record: T): T & { translationStatus: TranslationStatus } {
  const hash = sourceHash(record);
  const translationStatus = Object.fromEntries(
    TRANSLATED_LOCALES.map((l) => [l, { status: 'approved', approvedSourceHash: hash, approvedAt: MIGRATED_AT }])
  ) as TranslationStatus;
  return { ...record, translationStatus };
}

function missingTranslations<T extends object>(record: T): T & { translationStatus: TranslationStatus } {
  const translationStatus = Object.fromEntries(
    TRANSLATED_LOCALES.map((l) => [l, { status: 'missing', approvedSourceHash: null, approvedAt: null }])
  ) as TranslationStatus;
  return { ...record, translationStatus };
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------
const projects: ProjectRecord[] = PROJECTS_DATA.map((p, i) =>
  approved({
    id: `project-${p.slug}`,
    status: 'published' as const,
    order: i + 1,
    slug: p.slug,
    seo: NO_SEO,
    category: L(p.category),
    categoryNumber: p.categoryNumber,
    title: L(p.title),
    country: L(p.country),
    years: L(p.years),
    capacity: Lopt(p.capacity),
    type: L(p.type),
    overview: L(p.overview),
    scope: Llist(p.scope),
    technology: L(p.technology),
    results: p.results ? Llist(p.results) : null,
    image: M(p.image),
    imagePosition: p.imagePosition ?? null,
    gallery: (p.gallery ?? []).map(M),
    relatedTechnologyId: `technology-${p.relatedTechSlug}`,
    specs: p.specs.map((s) => ({ label: L(s.label), value: L(s.value) })),
  })
);

const technologies: TechnologyRecord[] = TECHNOLOGIES_DATA.map((t, i) =>
  approved({
    id: `technology-${t.slug}`,
    status: 'published' as const,
    order: i + 1,
    slug: t.slug,
    seo: NO_SEO,
    categoryNumber: t.categoryNumber,
    categoryTitle: L(t.categoryTitle),
    title: L(t.title),
    subtitle: L(t.subtitle),
    overview: L(t.overview),
    patentInfo: t.patentInfo
      ? { patentNumber: L(t.patentInfo.patentNumber), location: L(t.patentInfo.location), keyPoints: Llist(t.patentInfo.keyPoints) }
      : null,
    rawMaterials: Llist(t.rawMaterials),
    processPrinciples: t.processPrinciples.map((pp) => ({ title: L(pp.title), description: L(pp.description) })),
    keyAdvantages: Llist(t.keyAdvantages),
    applications: Llist(t.applications),
    productsProduced: Llist(t.productsProduced),
    relatedProjectIds: t.relatedProjects.map((slug) => `project-${slug}`),
    image: M(t.image),
  })
);

const products: ProductRecord[] = PRODUCTS_DATA.map((p, i) =>
  approved({
    id: `product-${p.slug}`,
    status: 'published' as const,
    order: i + 1,
    slug: p.slug,
    seo: NO_SEO,
    categoryNumber: p.categoryNumber,
    categoryTitle: L(p.categoryTitle),
    title: L(p.title),
    description: L(p.description),
    rawMaterials: Llist(p.rawMaterials),
    productionTechnology: L(p.productionTechnology),
    applications: Llist(p.applications),
    characteristics: Llist(p.characteristics),
    relatedTechnologyId: `technology-${p.relatedTechSlug}`,
    relatedProjectId: `project-${p.relatedProjectSlug}`,
    image: M(p.image),
  })
);

const epcmStages: EpcmStageRecord[] = EPCM_STAGES.map((s, i) =>
  approved({
    id: `epcm-stage-${s.number}`,
    status: 'published' as const,
    order: i + 1,
    number: s.number,
    title: L(s.title),
    focus: L(s.focus),
    description: L(s.description),
    deliverables: Llist(s.deliverables),
    image: EPCM_STAGE_IMAGES[s.number] ? M(EPCM_STAGE_IMAGES[s.number]) : null,
  })
);

const emptyPatent = {
  legalStatus: null,
  statusLabel: null,
  patentLabel: null,
  jurisdiction: null,
  abstract: null,
  claimsSummary: null,
  registryNumber: null,
  code: null,
  location: null,
  overview: null,
  keyPillars: null,
  industrialImplementation: null,
  image: null,
  imageCaption: null,
};

const patents: PatentRecord[] = [
  ...HOME_PATENT_CARDS.map((p, i) =>
    approved({
      ...emptyPatent,
      id: HOME_PATENT_IDS[p.id],
      status: 'published' as const,
      order: i + 1,
      placements: ['home' as const],
      patentNo: p.patentNo,
      title: L(p.title),
      legalStatus: p.status === 'PATENT GRANTED' ? ('granted' as const) : ('application' as const),
      statusLabel: L(p.status),
      patentLabel: L(p.patentLabel),
      jurisdiction: L(p.jurisdiction),
      abstract: L(p.abstract),
      claimsSummary: Llist(p.claimsSummary),
    })
  ),
  ...PATENTS_DATA.map((p, i) => {
    const photo = PATENT_IMAGERY[i % PATENT_IMAGERY.length];
    return approved({
      ...emptyPatent,
      id: REGISTRY_PATENT_IDS[i],
      status: 'published' as const,
      order: HOME_PATENT_CARDS.length + i + 1,
      placements: ['registry' as const],
      patentNo: p.code.replace(/^PATENT (APPLICATION NO\. )?/, ''),
      registryNumber: p.number,
      code: L(p.code),
      title: L(p.title),
      location: L(p.location),
      overview: L(p.overview),
      keyPillars: p.keyPillars.map((k) => ({ title: L(k.title), description: L(k.description) })),
      industrialImplementation: L(p.industrialImplementation),
      image: photo ? M(photo.image) : null,
      imageCaption: photo ? L(photo.caption) : null,
    });
  }),
];

const videos: VideoRecord[] = COMPANY_VIDEOS.map((v, i) =>
  approved({
    id: `video-${v.id}`,
    status: 'published' as const,
    order: i + 1,
    number: v.number,
    category: L(v.category),
    title: L(v.title),
    headline: L(v.headline),
    description: L(v.description),
    video: M(v.src),
    poster: M(v.thumbnail),
  })
);

const settings: GlobalSettingsRecord = approved({
  id: 'settings' as const,
  siteName: SETTINGS_TEXT.siteName,
  primaryEmail: SETTINGS_TEXT.primaryEmail,
  footerTagline: L(SETTINGS_TEXT.footerTagline),
  footerLocation: L(SETTINGS_TEXT.footerLocation),
  copyright: L(SETTINGS_TEXT.copyright),
  logo: M(SETTINGS_TEXT.logo),
  logoReversed: M(SETTINGS_TEXT.logoReversed),
  footerBackground: M(SETTINGS_TEXT.footerBackground),
  footerBackgroundAlt: L(SETTINGS_TEXT.footerBackgroundAlt),
  headquarters: {
    name: L(SETTINGS_TEXT.headquarters.name),
    addressLine1: L(SETTINGS_TEXT.headquarters.addressLine1),
    addressLine2: L(SETTINGS_TEXT.headquarters.addressLine2),
    shortAddress: L(SETTINGS_TEXT.headquarters.shortAddress),
    jurisdiction: L(SETTINGS_TEXT.headquarters.jurisdiction),
    hours: L(SETTINGS_TEXT.headquarters.hours),
    email: SETTINGS_TEXT.headquarters.email,
  },
  metrics: METRICS.map((m) => {
    const label = L(m.label);
    // placeholder renamed {epc} → {highlight} in every language
    for (const k of Object.keys(label) as Locale[]) label[k] = label[k].replace('{epc}', '{highlight}');
    return { id: m.id, value: m.value, label, highlight: Lopt(m.highlight) };
  }),
  offices: GLOBAL_OFFICES.map((o, i) => ({
    id: `office-${String(i + 1).padStart(2, '0')}`,
    order: i + 1,
    region: L(o.region),
    title: L(o.title),
    country: L(o.country),
    address: Lopt(o.address),
    representative: Lopt(o.representative),
    phone: o.phone ?? null,
    email: o.email,
    whatsapp: o.whatsapp ?? null,
  })),
  defaultSeo: { siteTitle: L(HOME_TITLE), siteDescription: L(HOME_DESCRIPTION) },
});

// ---------------------------------------------------------------------------
// Pages & templates
// ---------------------------------------------------------------------------
const copyMap = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'copy-map.json'), 'utf8')) as {
  ui: Record<string, string>;
  copy: Record<string, Record<string, string>>;
};
const headers = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'page-headers.json'), 'utf8')) as Record<
  string,
  { badgeNumber: string; badgeLabel: string; title: string; subtitle?: string; description?: string; meta: { label: string; value: string }[]; actionLabel?: string; inquiryTopic?: string }
>;

function copyOf(key: string, extra: Record<string, string> = {}): Record<string, Localized> {
  const entries = { ...(copyMap.copy[key] ?? {}), ...extra };
  return Object.fromEntries(Object.entries(entries).map(([k, en]) => [k, L(en)]));
}

function headerOf(key: string): PageHeaderRecord {
  const h = headers[key];
  return {
    badgeNumber: h.badgeNumber,
    badgeLabel: L(h.badgeLabel),
    title: L(h.title),
    subtitle: Lopt(h.subtitle),
    description: Lopt(h.description),
    meta: h.meta.map((m) => ({ label: L(m.label), value: L(m.value) })),
    actionLabel: Lopt(h.actionLabel),
  };
}

const mediaOf = (slots: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(slots ?? {}).map(([k, src]) => [k, M(src)]));

let order = 0;
function page(key: PageKey, kind: 'page' | 'template', parts: Partial<PageRecord>): PageRecord {
  order += 1;
  const base: Omit<PageRecord, 'translationStatus'> = {
    id: `page-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`,
    status: 'published',
    order,
    key,
    kind,
    header: null,
    copy: {},
    lists: {},
    media: {},
    body: null,
    seo: kind === 'page' ? NO_SEO : null,
    ...parts,
  };
  return approved(base);
}

const staticPage = (key: PageKey, extra: Partial<PageRecord> = {}) => {
  const h = headers[key];
  return page(key, 'page', {
    header: headerOf(key),
    copy: copyOf(key, h.inquiryTopic ? { inquiryTopic: h.inquiryTopic } : {}),
    media: mediaOf(PAGE_MEDIA[key]),
    ...extra,
  });
};

const pages: PageRecord[] = [
  page('home', 'page', {
    copy: copyOf('home', { heroEyebrow: HERO_DATA.eyebrow, heroDescription: HERO_DATA.description, heroUsp: HERO_DATA.usp }),
    lists: {
      heroTags: HERO_DATA.metadataTags.map((tag) => ({ label: L(tag) })),
      keyDirections: KEY_DIRECTIONS.map((d) => ({
        id: d.id,
        number: d.number,
        title: L(d.title),
        subtitle: L(d.subtitle ?? ''),
        description: L(d.description),
        image: M(d.image ?? ''),
        href: d.href,
        rawMaterials: Llist(d.rawMaterials),
        endProducts: Llist(d.endProducts),
        technologyFeatures: Llist(d.technologyFeatures),
      })),
    },
    media: mediaOf(PAGE_MEDIA.home),
    seo: { metaTitle: L(HOME_TITLE), metaDescription: L(HOME_DESCRIPTION), ogImage: null, noindex: false },
  }),
  staticPage('company', {
    lists: {
      capabilities: COMPANY_CAPABILITIES.map((c) => ({ title: L(c.title), description: L(c.description) })),
      timeline: COMPANY_TIMELINE.map((t) => ({ year: L(t.year), title: L(t.title), description: L(t.description) })),
    },
  }),
  staticPage('globalPresence'),
  staticPage('technologies'),
  staticPage('patents'),
  staticPage('epcm'),
  staticPage('products'),
  staticPage('projects'),
  staticPage('contact'),
  // Legal pages: architecture only. Draft (not routed, not indexed) until Soltex supplies text.
  ...(['privacy', 'terms'] as const).map((key) => {
    order += 1;
    const label = key === 'privacy' ? 'Privacy Policy' : 'Terms of Use';
    return missingTranslations({
      id: `page-${key}`,
      status: 'draft' as const,
      order,
      key,
      kind: 'page' as const,
      header: {
        badgeNumber: '',
        badgeLabel: L(label),
        title: L(label),
        subtitle: null,
        description: null, // PENDING CLIENT CONTENT
        meta: [],
        actionLabel: null,
      },
      copy: {},
      lists: {},
      media: {},
      body: null, // PENDING CLIENT CONTENT — no legal text is invented
      seo: NO_SEO,
    });
  }),
  page('projectDetail', 'template', { copy: copyOf('projectDetail'), media: mediaOf(TEMPLATE_MEDIA.projectDetail) }),
  page('technologyDetail', 'template', { copy: copyOf('technologyDetail'), media: mediaOf(TEMPLATE_MEDIA.technologyDetail) }),
  page('productDetail', 'template', { copy: copyOf('productDetail') }),
];

// ---------------------------------------------------------------------------
// UI strings
// ---------------------------------------------------------------------------
const newUi = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'new-ui-strings.json'), 'utf8')) as Record<string, Localized | string>;
const uiKeys = Object.keys(copyMap.ui).sort();
const ui: Record<Locale, Record<string, string>> = Object.fromEntries(LOCALES.map((l) => [l.code, {}])) as never;
for (const key of uiKeys) {
  const loc = L(copyMap.ui[key]);
  for (const l of LOCALES) ui[l.code][key] = loc[l.code];
}
for (const [key, value] of Object.entries(newUi)) {
  if (key.startsWith('_')) continue;
  for (const l of LOCALES) ui[l.code][key] = (value as Localized)[l.code];
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
await measureMedia();

const write = (rel: string, data: unknown) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};

write('src/content/seed/pages.json', pages);
write('src/content/seed/projects.json', projects);
write('src/content/seed/technologies.json', technologies);
write('src/content/seed/products.json', products);
write('src/content/seed/epcm-stages.json', epcmStages);
write('src/content/seed/patents.json', patents);
write('src/content/seed/videos.json', videos);
write('src/content/seed/media.json', [...media.values()].sort((a, b) => a.id.localeCompare(b.id)));
write('src/content/seed/settings.json', settings);
write('src/content/seed/redirects.json', []);
for (const l of LOCALES) {
  const sorted = Object.fromEntries(Object.keys(ui[l.code]).sort().map((k) => [k, ui[l.code][k]]));
  write(`src/i18n/ui/${l.code}.json`, sorted);
}

// Report: legacy dictionary entries not consumed by the migration (= unused or missed strings)
const report = {
  untranslatedInLegacy: Object.fromEntries(Object.entries(untranslated).map(([l, v]) => [l, [...new Set(v)]])),
  legacyKeysNotMigrated: Object.fromEntries(
    TRANSLATED_LOCALES.map((l) => [l, Object.keys(dictionaries[l]).filter((k) => !usedLegacyKeys.has(k))])
  ),
};
write('scripts/content/migration/migration-report.json', report);
console.log(
  `migrated: ${pages.length} pages, ${projects.length} projects, ${technologies.length} technologies, ${products.length} products, ` +
    `${epcmStages.length} EPCM stages, ${patents.length} patents, ${videos.length} videos, ${media.size} media, ${Object.keys(ui.en).length} UI keys`
);
console.log(`legacy dictionary entries not migrated (ru): ${report.legacyKeysNotMigrated.ru.length}`);
