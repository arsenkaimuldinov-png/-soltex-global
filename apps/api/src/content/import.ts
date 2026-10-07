/**
 * Import a ContentStore (seed format) into the content database.
 *
 * - Idempotent: entities are matched by their stable `key` (the content-layer ID) and updated
 *   in place; translation rows are upserted; ordered child rows (gallery, related projects,
 *   page media, page list items) are replaced. Running it twice changes nothing.
 * - Atomic: everything runs in one transaction; any error rolls the whole import back.
 * - Never deletes entities that exist in the database but not in the store (reported instead).
 */
import { eq, notInArray, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { CONTENT_LOCALES, SOURCE_LOCALE, type Locale, type TranslatedLocale } from '@soltex/core/domain';
import {
  JSONB_SCHEMA_VERSION,
  LabelValueListV1,
  ListItemStructureV1,
  ListItemTextsV1,
  PageBodyV1,
  PageCopyV1,
  PatentInfoV1,
  TextListV1,
  TitleDescriptionListV1,
  isLocalized,
  projectLocale,
  splitText,
  type ContentStore,
  type Localized,
  type MediaRef,
  type TranslationStatus,
} from '@soltex/core/content';
import type { z } from 'zod';
import type { Queryable } from '../db/client.ts';
import * as s from '../db/schema.ts';

export interface ImportReport {
  counts: Record<string, number>;
  /** Keys present in the database but not in the imported store (not deleted). */
  notInStore: Record<string, string[]>;
}

export class ImportError extends Error {}

type Tx = Queryable;

/** Any content table with a stable `key` and a uuid `id`. */
type KeyedTable = PgTable & { key: unknown; id: unknown };
const conflictTarget = (cols: Parameters<ReturnType<ReturnType<Queryable['insert']>['values']>['onConflictDoUpdate']>[0]['target']) => cols;

/** Text of a translatable value for one language (`null` stays `null`). */
function at<T>(value: T, locale: Locale): unknown {
  return value === null || value === undefined ? null : projectLocale(value, locale);
}

/** Text column value: the Localized must be a Localized (or null when nullable). */
function textAt(value: Localized | null, locale: Locale, where: string): string | null {
  if (value === null) return null;
  if (!isLocalized(value)) throw new ImportError(`${where}: expected a translatable text`);
  return value[locale];
}

/** JSONB column value for one language, validated by its schema. */
function jsonAt<S extends z.ZodType>(schema: S, value: unknown, locale: Locale, where: string): z.infer<S> | null {
  if (value === null || value === undefined) return null;
  const projected = projectLocale(value, locale);
  const parsed = schema.safeParse(projected);
  if (!parsed.success) throw new ImportError(`${where} [${locale}]: ${parsed.error.message}`);
  return parsed.data;
}

function trStatus(status: TranslationStatus, locale: Locale, where: string) {
  if (locale === SOURCE_LOCALE) return { trStatus: null, approvedSourceHash: null, approvedAt: null };
  const e = status[locale as TranslatedLocale];
  if (!e) throw new ImportError(`${where}: missing translationStatus.${locale}`);
  return { trStatus: e.status, approvedSourceHash: e.approvedSourceHash, approvedAt: e.approvedAt };
}

function sameSlug(slug: string) {
  // Slugs are identical in every language until localized slugs are enabled (approved: DEFERRED).
  return slug;
}

const now = () => new Date();

export async function importStore(tx: Tx, store: ContentStore): Promise<ImportReport> {
  const counts: Record<string, number> = {};
  const notInStore: Record<string, string[]> = {};
  const count = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  /** Upsert an entity row by its stable key and return its id. */
  async function upsertEntity(table: KeyedTable, values: Record<string, unknown>): Promise<string> {
    const t = table as unknown as typeof s.projects;
    const { key, ...rest } = values;
    const [row] = await tx
      .insert(t)
      .values(values as never)
      .onConflictDoUpdate({ target: t.key, set: { ...rest, updatedAt: now() } as never })
      .returning({ id: t.id });
    if (!row) throw new ImportError(`upsert of ${String(key)} returned nothing`);
    return row.id;
  }

  /** Upsert one row per language (conflict on the translation primary key). */
  async function upsertTranslations(table: PgTable, target: Parameters<typeof conflictTarget>[0], rows: Record<string, unknown>[]) {
    for (const row of rows) {
      await tx
        .insert(table)
        .values(row as never)
        .onConflictDoUpdate({ target: conflictTarget(target), set: { ...row, updatedAt: now() } as never });
    }
  }

  async function reportMissing(table: KeyedTable, name: string, keys: string[]) {
    const t = table as unknown as typeof s.projects;
    const extra = await tx.select({ key: t.key }).from(t).where(keys.length ? notInArray(t.key, keys) : sql`true`);
    if (extra.length) notInStore[name] = extra.map((r) => r.key);
  }

  // ---- media --------------------------------------------------------------
  const mediaId = new Map<string, string>();
  for (const m of store.media) {
    const id = await upsertEntity(s.media, { key: m.id, kind: m.kind, src: m.src, width: m.width, height: m.height });
    mediaId.set(m.id, id);
    if (m.alt === null) await tx.delete(s.mediaTranslations).where(eq(s.mediaTranslations.mediaId, id));
    else
      await upsertTranslations(
        s.mediaTranslations,
        [s.mediaTranslations.mediaId, s.mediaTranslations.locale],
        CONTENT_LOCALES.map((l) => ({ mediaId: id, locale: l, alt: textAt(m.alt, l, `media ${m.id}.alt`) }))
      );
    count('media');
  }
  const ref = (r: MediaRef | null, where: string): string | null => {
    if (r === null) return null;
    const id = mediaId.get(r.mediaId);
    if (!id) throw new ImportError(`${where}: unknown media "${r.mediaId}"`);
    return id;
  };
  const refReq = (r: MediaRef, where: string): string => ref(r, where)!;

  // ---- technologies (before projects: projects reference technologies) ----
  const techId = new Map<string, string>();
  for (const t of store.technologies) {
    const w = `technology ${t.id}`;
    const id = await upsertEntity(s.technologies, {
      key: t.id,
      status: t.status,
      position: t.order,
      categoryNumber: t.categoryNumber,
      imageId: refReq(t.image, `${w}.image`),
      ogImageId: ref(t.seo.ogImage, `${w}.seo.ogImage`),
      noindex: t.seo.noindex,
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    techId.set(t.id, id);
    await upsertTranslations(
      s.technologyTranslations,
      [s.technologyTranslations.technologyId, s.technologyTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        technologyId: id,
        locale: l,
        ...trStatus(t.translationStatus, l, w),
        slug: sameSlug(t.slug),
        categoryTitle: textAt(t.categoryTitle, l, w),
        title: textAt(t.title, l, w),
        subtitle: textAt(t.subtitle, l, w),
        overview: textAt(t.overview, l, w),
        patentInfo: jsonAt(PatentInfoV1, t.patentInfo, l, `${w}.patentInfo`),
        rawMaterials: jsonAt(TextListV1, t.rawMaterials, l, `${w}.rawMaterials`),
        processPrinciples: jsonAt(TitleDescriptionListV1, t.processPrinciples, l, `${w}.processPrinciples`),
        keyAdvantages: jsonAt(TextListV1, t.keyAdvantages, l, `${w}.keyAdvantages`),
        applications: jsonAt(TextListV1, t.applications, l, `${w}.applications`),
        productsProduced: jsonAt(TextListV1, t.productsProduced, l, `${w}.productsProduced`),
        seoMetaTitle: textAt(t.seo.metaTitle, l, `${w}.seo.metaTitle`),
        seoMetaDescription: textAt(t.seo.metaDescription, l, `${w}.seo.metaDescription`),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    count('technologies');
  }
  const techRef = (key: string, where: string) => {
    const id = techId.get(key);
    if (!id) throw new ImportError(`${where}: unknown technology "${key}"`);
    return id;
  };

  // ---- projects -----------------------------------------------------------
  const projectId = new Map<string, string>();
  for (const p of store.projects) {
    const w = `project ${p.id}`;
    const id = await upsertEntity(s.projects, {
      key: p.id,
      status: p.status,
      position: p.order,
      categoryNumber: p.categoryNumber,
      imageId: refReq(p.image, `${w}.image`),
      imagePosition: p.imagePosition,
      relatedTechnologyId: techRef(p.relatedTechnologyId, `${w}.relatedTechnologyId`),
      ogImageId: ref(p.seo.ogImage, `${w}.seo.ogImage`),
      noindex: p.seo.noindex,
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    projectId.set(p.id, id);
    await upsertTranslations(
      s.projectTranslations,
      [s.projectTranslations.projectId, s.projectTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        projectId: id,
        locale: l,
        ...trStatus(p.translationStatus, l, w),
        slug: sameSlug(p.slug),
        category: textAt(p.category, l, w),
        title: textAt(p.title, l, w),
        country: textAt(p.country, l, w),
        years: textAt(p.years, l, w),
        capacity: textAt(p.capacity, l, w),
        type: textAt(p.type, l, w),
        overview: textAt(p.overview, l, w),
        scope: jsonAt(TextListV1, p.scope, l, `${w}.scope`),
        technology: textAt(p.technology, l, w),
        results: jsonAt(TextListV1, p.results, l, `${w}.results`),
        specs: jsonAt(LabelValueListV1, p.specs, l, `${w}.specs`),
        seoMetaTitle: textAt(p.seo.metaTitle, l, `${w}.seo.metaTitle`),
        seoMetaDescription: textAt(p.seo.metaDescription, l, `${w}.seo.metaDescription`),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    await tx.delete(s.projectGallery).where(eq(s.projectGallery.projectId, id));
    if (p.gallery.length)
      await tx.insert(s.projectGallery).values(p.gallery.map((g, i) => ({ projectId: id, position: i, mediaId: refReq(g, `${w}.gallery[${i}]`) })));
    count('projects');
  }
  const projectRef = (key: string, where: string) => {
    const id = projectId.get(key);
    if (!id) throw new ImportError(`${where}: unknown project "${key}"`);
    return id;
  };

  // technology → related projects (after both exist)
  for (const t of store.technologies) {
    const id = techId.get(t.id)!;
    await tx.delete(s.technologyProjects).where(eq(s.technologyProjects.technologyId, id));
    if (t.relatedProjectIds.length)
      await tx.insert(s.technologyProjects).values(
        t.relatedProjectIds.map((k, i) => ({ technologyId: id, position: i, projectId: projectRef(k, `technology ${t.id}.relatedProjectIds[${i}]`) }))
      );
  }

  // ---- products -----------------------------------------------------------
  for (const p of store.products) {
    const w = `product ${p.id}`;
    const id = await upsertEntity(s.products, {
      key: p.id,
      status: p.status,
      position: p.order,
      categoryNumber: p.categoryNumber,
      imageId: refReq(p.image, `${w}.image`),
      relatedTechnologyId: techRef(p.relatedTechnologyId, `${w}.relatedTechnologyId`),
      relatedProjectId: projectRef(p.relatedProjectId, `${w}.relatedProjectId`),
      ogImageId: ref(p.seo.ogImage, `${w}.seo.ogImage`),
      noindex: p.seo.noindex,
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    await upsertTranslations(
      s.productTranslations,
      [s.productTranslations.productId, s.productTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        productId: id,
        locale: l,
        ...trStatus(p.translationStatus, l, w),
        slug: sameSlug(p.slug),
        categoryTitle: textAt(p.categoryTitle, l, w),
        title: textAt(p.title, l, w),
        description: textAt(p.description, l, w),
        rawMaterials: jsonAt(TextListV1, p.rawMaterials, l, `${w}.rawMaterials`),
        productionTechnology: textAt(p.productionTechnology, l, w),
        applications: jsonAt(TextListV1, p.applications, l, `${w}.applications`),
        characteristics: jsonAt(TextListV1, p.characteristics, l, `${w}.characteristics`),
        seoMetaTitle: textAt(p.seo.metaTitle, l, `${w}.seo.metaTitle`),
        seoMetaDescription: textAt(p.seo.metaDescription, l, `${w}.seo.metaDescription`),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    count('products');
  }

  // ---- EPC/EPCM stages ----------------------------------------------------
  for (const e of store.epcmStages) {
    const w = `epcm stage ${e.id}`;
    const id = await upsertEntity(s.epcmStages, {
      key: e.id,
      status: e.status,
      position: e.order,
      number: e.number,
      imageId: ref(e.image, `${w}.image`),
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    await upsertTranslations(
      s.epcmStageTranslations,
      [s.epcmStageTranslations.stageId, s.epcmStageTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        stageId: id,
        locale: l,
        ...trStatus(e.translationStatus, l, w),
        title: textAt(e.title, l, w),
        focus: textAt(e.focus, l, w),
        description: textAt(e.description, l, w),
        deliverables: jsonAt(TextListV1, e.deliverables, l, `${w}.deliverables`),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    count('epcmStages');
  }

  // ---- patents ------------------------------------------------------------
  for (const p of store.patents) {
    const w = `patent ${p.id}`;
    const id = await upsertEntity(s.patents, {
      key: p.id,
      status: p.status,
      position: p.order,
      placements: p.placements,
      patentNo: p.patentNo,
      legalStatus: p.legalStatus,
      registryNumber: p.registryNumber,
      imageId: ref(p.image, `${w}.image`),
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    await upsertTranslations(
      s.patentTranslations,
      [s.patentTranslations.patentId, s.patentTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        patentId: id,
        locale: l,
        ...trStatus(p.translationStatus, l, w),
        title: textAt(p.title, l, w),
        statusLabel: textAt(p.statusLabel, l, w),
        patentLabel: textAt(p.patentLabel, l, w),
        jurisdiction: textAt(p.jurisdiction, l, w),
        abstract: textAt(p.abstract, l, w),
        claimsSummary: jsonAt(TextListV1, p.claimsSummary, l, `${w}.claimsSummary`),
        code: textAt(p.code, l, w),
        location: textAt(p.location, l, w),
        overview: textAt(p.overview, l, w),
        keyPillars: jsonAt(TitleDescriptionListV1, p.keyPillars, l, `${w}.keyPillars`),
        industrialImplementation: textAt(p.industrialImplementation, l, w),
        imageCaption: textAt(p.imageCaption, l, w),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    count('patents');
  }

  // ---- videos -------------------------------------------------------------
  for (const v of store.videos) {
    const w = `video ${v.id}`;
    const id = await upsertEntity(s.videos, {
      key: v.id,
      status: v.status,
      position: v.order,
      number: v.number,
      videoId: refReq(v.video, `${w}.video`),
      posterId: refReq(v.poster, `${w}.poster`),
    });
    await upsertTranslations(
      s.videoTranslations,
      [s.videoTranslations.videoId, s.videoTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        videoId: id,
        locale: l,
        ...trStatus(v.translationStatus, l, w),
        category: textAt(v.category, l, w),
        title: textAt(v.title, l, w),
        headline: textAt(v.headline, l, w),
        description: textAt(v.description, l, w),
      }))
    );
    count('videos');
  }

  // ---- pages --------------------------------------------------------------
  for (const p of store.pages) {
    const w = `page ${p.id}`;
    const h = p.header;
    const id = await upsertEntity(s.pages, {
      key: p.id,
      status: p.status,
      position: p.order,
      pageKey: p.key,
      kind: p.kind,
      hasHeader: h !== null,
      headerBadgeNumber: h?.badgeNumber ?? null,
      listKeys: Object.keys(p.lists),
      hasSeo: p.seo !== null,
      ogImageId: ref(p.seo?.ogImage ?? null, `${w}.seo.ogImage`),
      noindex: p.seo?.noindex ?? false,
      schemaVersion: JSONB_SCHEMA_VERSION,
    });
    await upsertTranslations(
      s.pageTranslations,
      [s.pageTranslations.pageId, s.pageTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        pageId: id,
        locale: l,
        ...trStatus(p.translationStatus, l, w),
        headerBadgeLabel: textAt(h?.badgeLabel ?? null, l, `${w}.header`),
        headerTitle: textAt(h?.title ?? null, l, `${w}.header`),
        headerSubtitle: textAt(h?.subtitle ?? null, l, `${w}.header`),
        headerDescription: textAt(h?.description ?? null, l, `${w}.header`),
        headerMeta: h ? jsonAt(LabelValueListV1, h.meta, l, `${w}.header.meta`) : null,
        headerActionLabel: textAt(h?.actionLabel ?? null, l, `${w}.header`),
        copy: PageCopyV1.parse(Object.entries(p.copy).map(([slot, text]) => ({ slot, text: textAt(text, l, `${w}.copy.${slot}`) }))),
        body: jsonAt(PageBodyV1, p.body, l, `${w}.body`),
        seoMetaTitle: textAt(p.seo?.metaTitle ?? null, l, `${w}.seo.metaTitle`),
        seoMetaDescription: textAt(p.seo?.metaDescription ?? null, l, `${w}.seo.metaDescription`),
        schemaVersion: JSONB_SCHEMA_VERSION,
      }))
    );
    await tx.delete(s.pageMedia).where(eq(s.pageMedia.pageId, id));
    const slots = Object.entries(p.media);
    if (slots.length)
      await tx.insert(s.pageMedia).values(slots.map(([slot, m], i) => ({ pageId: id, slot, position: i, mediaId: refReq(m, `${w}.media.${slot}`) })));
    await tx.delete(s.pageListItems).where(eq(s.pageListItems.pageId, id));
    for (const [listKey, items] of Object.entries(p.lists)) {
      for (const [i, item] of items.entries()) {
        const { structure, texts } = splitText(item);
        const where = `${w}.lists.${listKey}[${i}]`;
        const st = ListItemStructureV1.safeParse(structure);
        if (!st.success) throw new ImportError(`${where}: ${st.error.message}`);
        const [row] = await tx
          .insert(s.pageListItems)
          .values({ pageId: id, listKey, position: i, structure: st.data, schemaVersion: JSONB_SCHEMA_VERSION })
          .returning({ id: s.pageListItems.id });
        await tx.insert(s.pageListItemTranslations).values(
          CONTENT_LOCALES.map((l) => ({ itemId: row!.id, locale: l, texts: ListItemTextsV1.parse(texts[l]), schemaVersion: JSONB_SCHEMA_VERSION }))
        );
        count('pageListItems');
      }
    }
    count('pages');
  }

  // ---- settings, metrics, offices ----------------------------------------
  {
    const st = store.settings;
    const w = 'settings';
    const hq = st.headquarters;
    const id = await upsertEntity(s.settings, {
      key: st.id,
      siteName: st.siteName,
      primaryEmail: st.primaryEmail,
      logoId: refReq(st.logo, `${w}.logo`),
      logoReversedId: refReq(st.logoReversed, `${w}.logoReversed`),
      footerBackgroundId: refReq(st.footerBackground, `${w}.footerBackground`),
      hqEmail: hq.email,
    });
    await upsertTranslations(
      s.settingsTranslations,
      [s.settingsTranslations.settingsId, s.settingsTranslations.locale],
      CONTENT_LOCALES.map((l) => ({
        settingsId: id,
        locale: l,
        ...trStatus(st.translationStatus, l, w),
        footerTagline: textAt(st.footerTagline, l, w),
        footerLocation: textAt(st.footerLocation, l, w),
        copyright: textAt(st.copyright, l, w),
        footerBackgroundAlt: textAt(st.footerBackgroundAlt, l, w),
        hqName: textAt(hq.name, l, w),
        hqAddressLine1: textAt(hq.addressLine1, l, w),
        hqAddressLine2: textAt(hq.addressLine2, l, w),
        hqShortAddress: textAt(hq.shortAddress, l, w),
        hqJurisdiction: textAt(hq.jurisdiction, l, w),
        hqHours: textAt(hq.hours, l, w),
        defaultSiteTitle: textAt(st.defaultSeo.siteTitle, l, w),
        defaultSiteDescription: textAt(st.defaultSeo.siteDescription, l, w),
      }))
    );
    // Metrics: positions are unique, so move existing rows out of the way first.
    await tx.update(s.metrics).set({ position: sql`-1 - ${s.metrics.position}` });
    for (const [i, m] of st.metrics.entries()) {
      const mid = await upsertEntity(s.metrics, { key: m.id, position: i, value: m.value });
      await upsertTranslations(
        s.metricTranslations,
        [s.metricTranslations.metricId, s.metricTranslations.locale],
        CONTENT_LOCALES.map((l) => ({ metricId: mid, locale: l, label: textAt(m.label, l, `metric ${m.id}`), highlight: textAt(m.highlight, l, `metric ${m.id}`) }))
      );
      count('metrics');
    }
    for (const o of st.offices) {
      const oid = await upsertEntity(s.offices, { key: o.id, position: o.order, phone: o.phone, email: o.email, whatsapp: o.whatsapp });
      await upsertTranslations(
        s.officeTranslations,
        [s.officeTranslations.officeId, s.officeTranslations.locale],
        CONTENT_LOCALES.map((l) => ({
          officeId: oid,
          locale: l,
          region: textAt(o.region, l, `office ${o.id}`),
          title: textAt(o.title, l, `office ${o.id}`),
          country: textAt(o.country, l, `office ${o.id}`),
          address: textAt(o.address, l, `office ${o.id}`),
          representative: textAt(o.representative, l, `office ${o.id}`),
        }))
      );
      count('offices');
    }
    count('settings');
    await reportMissing(s.metrics, 'metrics', st.metrics.map((m) => m.id));
    await reportMissing(s.offices, 'offices', st.offices.map((o) => o.id));
  }

  // ---- redirects ----------------------------------------------------------
  for (const r of store.redirects) {
    await upsertEntity(s.redirects, { key: r.id, fromPath: r.from, toPath: r.to, statusCode: r.statusCode, allLocales: r.allLocales, source: 'import' });
    count('redirects');
  }

  await reportMissing(s.media, 'media', store.media.map((m) => m.id));
  await reportMissing(s.technologies as KeyedTable, 'technologies', store.technologies.map((t) => t.id));
  await reportMissing(s.projects, 'projects', store.projects.map((p) => p.id));
  await reportMissing(s.products as KeyedTable, 'products', store.products.map((p) => p.id));
  await reportMissing(s.epcmStages as KeyedTable, 'epcmStages', store.epcmStages.map((e) => e.id));
  await reportMissing(s.patents as KeyedTable, 'patents', store.patents.map((p) => p.id));
  await reportMissing(s.videos as KeyedTable, 'videos', store.videos.map((v) => v.id));
  await reportMissing(s.pages as KeyedTable, 'pages', store.pages.map((p) => p.id));
  await reportMissing(s.redirects, 'redirects', store.redirects.map((r) => r.id));

  return { counts, notInStore };
}
