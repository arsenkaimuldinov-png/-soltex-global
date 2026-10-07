/**
 * Content domain model.
 *
 * Two shapes exist for every entity:
 *
 *  - `*Record` — the STORED shape (seed JSON today, a database / custom-admin API later).
 *    Translatable fields are `Localized` objects ({ en, ru, zh, tr, ar, es }); everything
 *    else (IDs, slugs, numbers, codes, URLs, relations) is a plain typed value.
 *
 *  - The RESOLVED shape (`Project`, `Technology`, …) — what React components receive:
 *    the same object for ONE language, with every `Localized` replaced by a string and every
 *    `MediaRef` replaced by a `MediaAsset`. Produced by `normalize.ts`.
 *
 * Components never see `Localized` values and never know where content came from.
 */
import type { Locale, Localized } from './locale';

// ---------------------------------------------------------------------------
// Stored (multilingual) shapes: defined in @soltex/core/content (moved there in Phase B,
// unchanged), re-exported here so the site keeps importing them from this module.
// ---------------------------------------------------------------------------
import type {
  PublishStatus,
  TranslationState,
  TranslationStatusEntry,
  TranslationStatus,
  MediaRef,
  MediaRecord,
  SeoRecord,
  LabelValueRecord,
  TitleDescriptionRecord,
  ProjectRecord,
  PatentInfoRecord,
  TechnologyRecord,
  ProductRecord,
  EpcmStageRecord,
  PatentRecord,
  VideoRecord,
  OfficeRecord,
  MetricRecord,
  GlobalSettingsRecord,
  PageHeaderRecord,
  PageRouteKey,
  TemplateKey,
  PageKey,
  CopyMap,
  PageListItemRecord,
  PageRecord,
  RedirectRecord,
  ContentStore,
} from '@soltex/core/content';
export type {
  PublishStatus,
  TranslationState,
  TranslationStatusEntry,
  TranslationStatus,
  MediaRef,
  MediaRecord,
  SeoRecord,
  LabelValueRecord,
  TitleDescriptionRecord,
  ProjectRecord,
  PatentInfoRecord,
  TechnologyRecord,
  ProductRecord,
  EpcmStageRecord,
  PatentRecord,
  VideoRecord,
  OfficeRecord,
  MetricRecord,
  GlobalSettingsRecord,
  PageHeaderRecord,
  PageRouteKey,
  TemplateKey,
  PageKey,
  CopyMap,
  PageListItemRecord,
  PageRecord,
  RedirectRecord,
  ContentStore,
};

/** A resolved media asset — what components receive. */
export interface MediaAsset {
  id: string;
  kind: 'image' | 'video';
  /** Final URL to put in src/href (already resolved against the media base URL). */
  src: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}

// ---------------------------------------------------------------------------
// Resolved (single-language) shapes
// ---------------------------------------------------------------------------

/**
 * Replace every Localized<string> with string and every MediaRef with MediaAsset,
 * recursively. TranslationStatus metadata is dropped from resolved objects.
 */
export type Resolved<T> = T extends Localized
  ? string
  : T extends MediaRef
    ? MediaAsset
    : T extends (infer U)[]
      ? Resolved<U>[]
      : T extends object
        ? { [K in keyof T as K extends 'translationStatus' ? never : K]: Resolved<T[K]> }
        : T;

/** Metadata the resolver adds to every resolved entity. */
export interface ResolvedMeta {
  /** Language the entity's text is actually in (English when a translation is not approved). */
  contentLocale: Locale;
  /** Languages in which this entity has approved content (English always included). */
  availableLocales: Locale[];
}

export type Project = Resolved<ProjectRecord> & ResolvedMeta;
export type Technology = Resolved<TechnologyRecord> & ResolvedMeta;
export type Product = Resolved<ProductRecord> & ResolvedMeta;
export type EpcmStage = Resolved<EpcmStageRecord> & ResolvedMeta;
export type Patent = Resolved<PatentRecord> & ResolvedMeta;
export type Video = Resolved<VideoRecord> & ResolvedMeta;
export type Office = Resolved<OfficeRecord>;
export type Metric = Resolved<MetricRecord>;
export type GlobalSettings = Resolved<GlobalSettingsRecord> & ResolvedMeta;
export type Page = Resolved<PageRecord> & ResolvedMeta;
export type PageHeaderContent = Resolved<PageHeaderRecord>;
export type Redirect = RedirectRecord;
export type Seo = Resolved<SeoRecord>;

/** All content for ONE language — the unit the frontend loads (per-locale snapshot). */
export interface ContentSnapshot {
  locale: Locale;
  pages: Page[];
  projects: Project[];
  technologies: Technology[];
  products: Product[];
  epcmStages: EpcmStage[];
  patents: Patent[];
  videos: Video[];
  settings: GlobalSettings;
  redirects: Redirect[];
}
