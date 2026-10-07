/**
 * Export the content database as a ContentStore (seed format).
 *
 * The result has exactly the shape and key order of the seed files, so
 *   import(seed) → export → JSON
 * is byte-identical to the seed (tested in src/content/roundtrip.test.ts), and the site build
 * can consume it unchanged (CONTENT_SOURCE=file, see apps/web/src/content/sources/file.ts).
 *
 * Optionally only `published` entities could be exported for a release; Phase B exports
 * every status, exactly like the seed (the site build filters by status itself).
 */
import { asc, sql } from 'drizzle-orm';
import { CONTENT_LOCALES, SOURCE_LOCALE, TRANSLATED_LOCALES, type Locale } from '@soltex/core/domain';
import {
  LabelValueListV1,
  ListItemStructureV1,
  ListItemTextsV1,
  PageBodyV1,
  PageCopyV1,
  PatentInfoV1,
  TextListV1,
  TitleDescriptionListV1,
  joinText,
  mergeLocales,
  type ContentStore,
  type EpcmStageRecord,
  type GlobalSettingsRecord,
  type LabelValueRecord,
  type Localized,
  type MediaRecord,
  type MediaRef,
  type PageListItemRecord,
  type PageRecord,
  type PatentInfoRecord,
  type PatentRecord,
  type ProductRecord,
  type ProjectRecord,
  type RedirectRecord,
  type TechnologyRecord,
  type TitleDescriptionRecord,
  type TranslationStatus,
  type VideoRecord,
} from '@soltex/core/content';
import type { z } from 'zod';
import type { Queryable } from '../db/client.ts';
import * as s from '../db/schema.ts';

export class ExportError extends Error {}

const fail = (message: string): never => {
  throw new ExportError(message);
};

type ByLocale<R> = Record<Locale, R>;

/** Group translation rows by owner id; every owner must have all content languages. */
function groupByOwner<R extends { locale: string }>(rows: R[], owner: (r: R) => string, what: string): Map<string, ByLocale<R>> {
  const map = new Map<string, Partial<ByLocale<R>>>();
  for (const r of rows) {
    const id = owner(r);
    const g = map.get(id) ?? {};
    g[r.locale as Locale] = r;
    map.set(id, g);
  }
  for (const [id, g] of map)
    for (const l of CONTENT_LOCALES) if (!g[l]) throw new ExportError(`${what} ${id}: missing "${l}" translation`);
  return map as Map<string, ByLocale<R>>;
}

function need<R>(map: Map<string, ByLocale<R>>, id: string, what: string): ByLocale<R> {
  const g = map.get(id);
  if (!g) throw new ExportError(`${what} ${id}: no translations`);
  return g;
}

/** Text column → Localized. */
function text<R>(rows: ByLocale<R>, f: (r: R) => string | null): Localized {
  const v = mergeLocales(byLocale(rows, f));
  if (v === null) throw new ExportError('required text is null');
  return v as Localized;
}

/** Nullable text column → Localized | null. */
function textOrNull<R>(rows: ByLocale<R>, f: (r: R) => string | null): Localized | null {
  return mergeLocales(byLocale(rows, f)) as Localized | null;
}

/** JSONB column → merged value (parsed by its schema first: canonical key order). */
function list<R, S extends z.ZodType>(rows: ByLocale<R>, schema: S, f: (r: R) => unknown): unknown {
  return mergeLocales(byLocale(rows, (r) => {
    const v = f(r);
    return v === null ? null : schema.parse(v);
  }));
}

function byLocale<R>(rows: ByLocale<R>, f: (r: R) => unknown): Record<Locale, unknown> {
  return Object.fromEntries(CONTENT_LOCALES.map((l) => [l, f(rows[l])])) as Record<Locale, unknown>;
}

interface TrCols {
  trStatus: 'missing' | 'in_progress' | 'approved' | null;
  approvedSourceHash: string | null;
  approvedAt: string | null;
}

function translationStatus<R extends TrCols>(rows: ByLocale<R>, what: string): TranslationStatus {
  const out = {} as TranslationStatus;
  for (const l of TRANSLATED_LOCALES) {
    const r = rows[l];
    if (!r.trStatus) throw new ExportError(`${what} [${l}]: translation status is not set`);
    out[l] = { status: r.trStatus, approvedSourceHash: r.approvedSourceHash, approvedAt: r.approvedAt };
  }
  return out;
}

function slugOf<R extends { slug: string }>(rows: ByLocale<R>, what: string): string {
  const slug = rows[SOURCE_LOCALE].slug;
  for (const l of CONTENT_LOCALES)
    if (rows[l].slug !== slug) throw new ExportError(`${what}: slug differs in "${l}" (localized slugs are not enabled)`);
  return slug;
}

export async function exportStore(db: Queryable): Promise<ContentStore> {
  // ---- media --------------------------------------------------------------
  const mediaRows = await db.select().from(s.media).orderBy(sql`${s.media.key} COLLATE "C"`);
  const mediaKey = new Map(mediaRows.map((m) => [m.id, m.key]));
  const mediaTr = groupByOwner(await db.select().from(s.mediaTranslations), (r) => r.mediaId, 'media');
  const ref = (id: string | null): MediaRef | null => {
    if (id === null) return null;
    const key = mediaKey.get(id);
    if (!key) throw new ExportError(`unknown media id ${id}`);
    return { mediaId: key };
  };
  const refReq = (id: string): MediaRef => ref(id)!;
  const media: MediaRecord[] = mediaRows.map((m) => {
    const tr = mediaTr.get(m.id);
    return {
      id: m.key,
      kind: m.kind,
      src: m.src,
      width: m.width,
      height: m.height,
      alt: tr ? text(tr, (r) => r.alt) : null,
    };
  });

  const seo = (rows: ByLocale<{ seoMetaTitle: string | null; seoMetaDescription: string | null }>, ogImageId: string | null, noindex: boolean) => ({
    metaTitle: textOrNull(rows, (r) => r.seoMetaTitle),
    metaDescription: textOrNull(rows, (r) => r.seoMetaDescription),
    ogImage: ref(ogImageId),
    noindex,
  });

  // ---- technologies, projects, products ----------------------------------
  const techRows = await db.select().from(s.technologies).orderBy(asc(s.technologies.position), asc(s.technologies.key));
  const projRows = await db.select().from(s.projects).orderBy(asc(s.projects.position), asc(s.projects.key));
  const techKey = new Map(techRows.map((t) => [t.id, t.key]));
  const projKey = new Map(projRows.map((p) => [p.id, p.key]));
  const keyOf = (map: Map<string, string>, id: string, what: string) => {
    const k = map.get(id);
    if (!k) throw new ExportError(`unknown ${what} id ${id}`);
    return k;
  };

  const techTr = groupByOwner(await db.select().from(s.technologyTranslations), (r) => r.technologyId, 'technology');
  const techProjects = await db.select().from(s.technologyProjects).orderBy(asc(s.technologyProjects.technologyId), asc(s.technologyProjects.position));
  const technologies: TechnologyRecord[] = techRows.map((t) => {
    const tr = need(techTr, t.id, `technology ${t.key}`);
    return {
      id: t.key,
      status: t.status,
      order: t.position,
      slug: slugOf(tr, `technology ${t.key}`),
      seo: seo(tr, t.ogImageId, t.noindex),
      categoryNumber: t.categoryNumber,
      categoryTitle: text(tr, (r) => r.categoryTitle),
      title: text(tr, (r) => r.title),
      subtitle: text(tr, (r) => r.subtitle),
      overview: text(tr, (r) => r.overview),
      patentInfo: list(tr, PatentInfoV1, (r) => r.patentInfo) as PatentInfoRecord | null,
      rawMaterials: list(tr, TextListV1, (r) => r.rawMaterials) as Localized[],
      processPrinciples: list(tr, TitleDescriptionListV1, (r) => r.processPrinciples) as TitleDescriptionRecord[],
      keyAdvantages: list(tr, TextListV1, (r) => r.keyAdvantages) as Localized[],
      applications: list(tr, TextListV1, (r) => r.applications) as Localized[],
      productsProduced: list(tr, TextListV1, (r) => r.productsProduced) as Localized[],
      relatedProjectIds: techProjects.filter((x) => x.technologyId === t.id).map((x) => keyOf(projKey, x.projectId, 'project')),
      image: refReq(t.imageId),
      translationStatus: translationStatus(tr, `technology ${t.key}`),
    };
  });

  const projTr = groupByOwner(await db.select().from(s.projectTranslations), (r) => r.projectId, 'project');
  const gallery = await db.select().from(s.projectGallery).orderBy(asc(s.projectGallery.projectId), asc(s.projectGallery.position));
  const projects: ProjectRecord[] = projRows.map((p) => {
    const tr = need(projTr, p.id, `project ${p.key}`);
    return {
      id: p.key,
      status: p.status,
      order: p.position,
      slug: slugOf(tr, `project ${p.key}`),
      seo: seo(tr, p.ogImageId, p.noindex),
      category: text(tr, (r) => r.category),
      categoryNumber: p.categoryNumber,
      title: text(tr, (r) => r.title),
      country: text(tr, (r) => r.country),
      years: text(tr, (r) => r.years),
      capacity: textOrNull(tr, (r) => r.capacity),
      type: text(tr, (r) => r.type),
      overview: text(tr, (r) => r.overview),
      scope: list(tr, TextListV1, (r) => r.scope) as Localized[],
      technology: text(tr, (r) => r.technology),
      results: list(tr, TextListV1, (r) => r.results) as Localized[] | null,
      image: refReq(p.imageId),
      imagePosition: p.imagePosition,
      gallery: gallery.filter((g) => g.projectId === p.id).map((g) => refReq(g.mediaId)),
      relatedTechnologyId: keyOf(techKey, p.relatedTechnologyId, 'technology'),
      specs: list(tr, LabelValueListV1, (r) => r.specs) as LabelValueRecord[],
      translationStatus: translationStatus(tr, `project ${p.key}`),
    };
  });

  const prodRows = await db.select().from(s.products).orderBy(asc(s.products.position), asc(s.products.key));
  const prodTr = groupByOwner(await db.select().from(s.productTranslations), (r) => r.productId, 'product');
  const products: ProductRecord[] = prodRows.map((p) => {
    const tr = need(prodTr, p.id, `product ${p.key}`);
    return {
      id: p.key,
      status: p.status,
      order: p.position,
      slug: slugOf(tr, `product ${p.key}`),
      seo: seo(tr, p.ogImageId, p.noindex),
      categoryNumber: p.categoryNumber,
      categoryTitle: text(tr, (r) => r.categoryTitle),
      title: text(tr, (r) => r.title),
      description: text(tr, (r) => r.description),
      rawMaterials: list(tr, TextListV1, (r) => r.rawMaterials) as Localized[],
      productionTechnology: text(tr, (r) => r.productionTechnology),
      applications: list(tr, TextListV1, (r) => r.applications) as Localized[],
      characteristics: list(tr, TextListV1, (r) => r.characteristics) as Localized[],
      relatedTechnologyId: keyOf(techKey, p.relatedTechnologyId, 'technology'),
      relatedProjectId: keyOf(projKey, p.relatedProjectId, 'project'),
      image: refReq(p.imageId),
      translationStatus: translationStatus(tr, `product ${p.key}`),
    };
  });

  // ---- EPC/EPCM stages, patents, videos ----------------------------------
  const stageRows = await db.select().from(s.epcmStages).orderBy(asc(s.epcmStages.position), asc(s.epcmStages.key));
  const stageTr = groupByOwner(await db.select().from(s.epcmStageTranslations), (r) => r.stageId, 'epcm stage');
  const epcmStages: EpcmStageRecord[] = stageRows.map((e) => {
    const tr = need(stageTr, e.id, `epcm stage ${e.key}`);
    return {
      id: e.key,
      status: e.status,
      order: e.position,
      number: e.number,
      title: text(tr, (r) => r.title),
      focus: text(tr, (r) => r.focus),
      description: text(tr, (r) => r.description),
      deliverables: list(tr, TextListV1, (r) => r.deliverables) as Localized[],
      image: ref(e.imageId),
      translationStatus: translationStatus(tr, `epcm stage ${e.key}`),
    };
  });

  const patentRows = await db.select().from(s.patents).orderBy(asc(s.patents.position), asc(s.patents.key));
  const patentTr = groupByOwner(await db.select().from(s.patentTranslations), (r) => r.patentId, 'patent');
  const patents: PatentRecord[] = patentRows.map((p) => {
    const tr = need(patentTr, p.id, `patent ${p.key}`);
    // Key order follows the seed file (patents.json lists the placement-specific fields first).
    return {
      legalStatus: p.legalStatus,
      statusLabel: textOrNull(tr, (r) => r.statusLabel),
      patentLabel: textOrNull(tr, (r) => r.patentLabel),
      jurisdiction: textOrNull(tr, (r) => r.jurisdiction),
      abstract: textOrNull(tr, (r) => r.abstract),
      claimsSummary: list(tr, TextListV1, (r) => r.claimsSummary) as Localized[] | null,
      registryNumber: p.registryNumber,
      code: textOrNull(tr, (r) => r.code),
      location: textOrNull(tr, (r) => r.location),
      overview: textOrNull(tr, (r) => r.overview),
      keyPillars: list(tr, TitleDescriptionListV1, (r) => r.keyPillars) as TitleDescriptionRecord[] | null,
      industrialImplementation: textOrNull(tr, (r) => r.industrialImplementation),
      image: ref(p.imageId),
      imageCaption: textOrNull(tr, (r) => r.imageCaption),
      id: p.key,
      status: p.status,
      order: p.position,
      placements: p.placements as PatentRecord['placements'],
      patentNo: p.patentNo,
      title: text(tr, (r) => r.title),
      translationStatus: translationStatus(tr, `patent ${p.key}`),
    };
  });

  const videoRows = await db.select().from(s.videos).orderBy(asc(s.videos.position), asc(s.videos.key));
  const videoTr = groupByOwner(await db.select().from(s.videoTranslations), (r) => r.videoId, 'video');
  const videos: VideoRecord[] = videoRows.map((v) => {
    const tr = need(videoTr, v.id, `video ${v.key}`);
    return {
      id: v.key,
      status: v.status,
      order: v.position,
      number: v.number,
      category: text(tr, (r) => r.category),
      title: text(tr, (r) => r.title),
      headline: text(tr, (r) => r.headline),
      description: text(tr, (r) => r.description),
      video: refReq(v.videoId),
      poster: refReq(v.posterId),
      translationStatus: translationStatus(tr, `video ${v.key}`),
    };
  });

  // ---- pages --------------------------------------------------------------
  const pageRows = await db.select().from(s.pages).orderBy(asc(s.pages.position), asc(s.pages.key));
  const pageTr = groupByOwner(await db.select().from(s.pageTranslations), (r) => r.pageId, 'page');
  const pageMediaRows = await db.select().from(s.pageMedia).orderBy(asc(s.pageMedia.pageId), asc(s.pageMedia.position));
  const itemRows = await db.select().from(s.pageListItems).orderBy(asc(s.pageListItems.pageId), asc(s.pageListItems.listKey), asc(s.pageListItems.position));
  const itemTr = groupByOwner(await db.select().from(s.pageListItemTranslations), (r) => r.itemId, 'page list item');
  const pages: PageRecord[] = pageRows.map((p) => {
    const tr = need(pageTr, p.id, `page ${p.key}`);
    const copyByLocale = byLocale(tr, (r) => PageCopyV1.parse(r.copy));
    const slots = (copyByLocale[SOURCE_LOCALE] as z.infer<typeof PageCopyV1>).map((c) => c.slot);
    const copy: Record<string, Localized> = {};
    for (const [i, slot] of slots.entries()) {
      copy[slot] = mergeLocales(
        Object.fromEntries(
          CONTENT_LOCALES.map((l) => {
            const entry = (copyByLocale[l] as z.infer<typeof PageCopyV1>)[i];
            if (!entry || entry.slot !== slot) throw new ExportError(`page ${p.key} [${l}]: copy slots differ from the source language`);
            return [l, entry.text];
          })
        ) as Record<Locale, unknown>
      ) as Localized;
    }
    const lists: Record<string, PageListItemRecord[]> = {};
    for (const listKey of p.listKeys) {
      lists[listKey] = itemRows
        .filter((i) => i.pageId === p.id && i.listKey === listKey)
        .map((i) => {
          const texts = need(itemTr, i.id, `page ${p.key} list ${listKey}`);
          return joinText(
            ListItemStructureV1.parse(i.structure),
            Object.fromEntries(CONTENT_LOCALES.map((l) => [l, ListItemTextsV1.parse(texts[l].texts)])) as Record<Locale, Record<string, string>>
          ) as PageListItemRecord;
        });
    }
    return {
      id: p.key,
      status: p.status,
      order: p.position,
      key: p.pageKey as PageRecord['key'],
      kind: p.kind,
      header: p.hasHeader
        ? {
            badgeNumber: p.headerBadgeNumber ?? fail(`page ${p.key}: header without badge number`),
            badgeLabel: text(tr, (r) => r.headerBadgeLabel),
            title: text(tr, (r) => r.headerTitle),
            subtitle: textOrNull(tr, (r) => r.headerSubtitle),
            description: textOrNull(tr, (r) => r.headerDescription),
            meta: list(tr, LabelValueListV1, (r) => r.headerMeta) as LabelValueRecord[],
            actionLabel: textOrNull(tr, (r) => r.headerActionLabel),
          }
        : null,
      copy,
      lists,
      media: Object.fromEntries(pageMediaRows.filter((m) => m.pageId === p.id).map((m) => [m.slot, refReq(m.mediaId)])),
      body: list(tr, PageBodyV1, (r) => r.body) as Localized[] | null,
      seo: p.hasSeo ? seo(tr, p.ogImageId, p.noindex) : null,
      translationStatus: translationStatus(tr, `page ${p.key}`),
    };
  });

  // ---- settings -----------------------------------------------------------
  const [st] = await db.select().from(s.settings);
  if (!st) throw new ExportError('settings: no row');
  const stTr = need(groupByOwner(await db.select().from(s.settingsTranslations), (r) => r.settingsId, 'settings'), st.id, 'settings');
  const metricRows = await db.select().from(s.metrics).orderBy(asc(s.metrics.position));
  const metricTr = groupByOwner(await db.select().from(s.metricTranslations), (r) => r.metricId, 'metric');
  const officeRows = await db.select().from(s.offices).orderBy(asc(s.offices.position), asc(s.offices.key));
  const officeTr = groupByOwner(await db.select().from(s.officeTranslations), (r) => r.officeId, 'office');
  const settings: GlobalSettingsRecord = {
    id: st.key as 'settings',
    siteName: st.siteName,
    primaryEmail: st.primaryEmail,
    footerTagline: text(stTr, (r) => r.footerTagline),
    footerLocation: text(stTr, (r) => r.footerLocation),
    copyright: text(stTr, (r) => r.copyright),
    logo: refReq(st.logoId),
    logoReversed: refReq(st.logoReversedId),
    footerBackground: refReq(st.footerBackgroundId),
    footerBackgroundAlt: text(stTr, (r) => r.footerBackgroundAlt),
    headquarters: {
      name: text(stTr, (r) => r.hqName),
      addressLine1: text(stTr, (r) => r.hqAddressLine1),
      addressLine2: text(stTr, (r) => r.hqAddressLine2),
      shortAddress: text(stTr, (r) => r.hqShortAddress),
      jurisdiction: text(stTr, (r) => r.hqJurisdiction),
      hours: text(stTr, (r) => r.hqHours),
      email: st.hqEmail,
    },
    metrics: metricRows.map((m) => {
      const tr = need(metricTr, m.id, `metric ${m.key}`);
      return { id: m.key, value: m.value, label: text(tr, (r) => r.label), highlight: textOrNull(tr, (r) => r.highlight) };
    }),
    offices: officeRows.map((o) => {
      const tr = need(officeTr, o.id, `office ${o.key}`);
      return {
        id: o.key,
        order: o.position,
        region: text(tr, (r) => r.region),
        title: text(tr, (r) => r.title),
        country: text(tr, (r) => r.country),
        address: textOrNull(tr, (r) => r.address),
        representative: textOrNull(tr, (r) => r.representative),
        phone: o.phone,
        email: o.email,
        whatsapp: o.whatsapp,
      };
    }),
    defaultSeo: {
      siteTitle: text(stTr, (r) => r.defaultSiteTitle),
      siteDescription: text(stTr, (r) => r.defaultSiteDescription),
    },
    translationStatus: translationStatus(stTr, 'settings'),
  };

  // ---- redirects ----------------------------------------------------------
  const redirectRows = await db.select().from(s.redirects).orderBy(sql`${s.redirects.fromPath} COLLATE "C"`);
  const redirects: RedirectRecord[] = redirectRows.map((r) => ({
    id: r.key,
    from: r.fromPath,
    to: r.toPath,
    statusCode: r.statusCode as 301 | 302,
    allLocales: r.allLocales,
  }));

  return { pages, projects, technologies, products, epcmStages, patents, videos, media, settings, redirects };
}
