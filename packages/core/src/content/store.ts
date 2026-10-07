/**
 * Stored content model: the multilingual shape of every content entity, as kept in the seed
 * JSON files, exported from the database and fed to the site build.
 *
 * Translatable fields are `Localized` objects (one string per content language); everything
 * else (IDs, slugs, numbers, codes, URLs, relations) is a plain typed value. The resolved,
 * single-language shapes that React components receive are defined by the site
 * (apps/web/src/content/types.ts) on top of these types.
 *
 * Moved from apps/web/src/content/types.ts in Phase B (unchanged).
 */
import type { Locale, TranslatedLocale } from '../domain/locales.ts';

/** One value per content language. The source language (`en`) is the source of truth. */
export type Localized<T = string> = { [L in Locale]: T };

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Publishing state. Only `published` content is rendered and indexed. */
export type PublishStatus = 'draft' | 'published' | 'archived';

/** Translation workflow state of one language of one entity. */
export type TranslationState = 'missing' | 'in_progress' | 'approved';

export interface TranslationStatusEntry {
  status: TranslationState;
  /** Hash of the English source fields at the moment this translation was approved. */
  approvedSourceHash: string | null;
  /** ISO date of approval. */
  approvedAt: string | null;
}

export type TranslationStatus = Record<TranslatedLocale, TranslationStatusEntry>;

/** Reference to an entry of the media library (`seed/media.json`). */
export interface MediaRef {
  mediaId: string;
}

/** A media library entry (stored shape). */
export interface MediaRecord {
  id: string;
  kind: 'image' | 'video';
  /**
   * Path or URL of the file. Today: a site-relative path under /public (e.g. "/images/x.jpg").
   * A future custom admin / object storage may supply absolute URLs instead.
   */
  src: string;
  width: number | null;
  height: number | null;
  /** Optional default alternative text (components may supply contextual alt text instead). */
  alt: Localized | null;
}

/** Per-entity SEO overrides. `null` means "use the frontend default template". */
export interface SeoRecord {
  metaTitle: Localized | null;
  metaDescription: Localized | null;
  ogImage: MediaRef | null;
  noindex: boolean;
}

interface EntityBase {
  /** Stable, deterministic ID. Never derived from translated text, never changes. */
  id: string;
  status: PublishStatus;
  /** Display order within its collection. */
  order: number;
  translationStatus: TranslationStatus;
}

interface RoutableBase extends EntityBase {
  /** URL segment, identical in every language. */
  slug: string;
  seo: SeoRecord;
}

export interface LabelValueRecord {
  label: Localized;
  value: Localized;
}

export interface TitleDescriptionRecord {
  title: Localized;
  description: Localized;
}

// ---------------------------------------------------------------------------
// Entities (stored shape)
// ---------------------------------------------------------------------------

export interface ProjectRecord extends RoutableBase {
  category: Localized;
  categoryNumber: string;
  title: Localized;
  /** Location as displayed (country, sometimes with region). */
  country: Localized;
  years: Localized;
  capacity: Localized | null;
  type: Localized;
  overview: Localized;
  scope: Localized[];
  /** Short description of the applied technology. */
  technology: Localized;
  results: Localized[] | null;
  image: MediaRef;
  /** CSS object-position for the hero/card photo, if it needs a custom crop. */
  imagePosition: string | null;
  gallery: MediaRef[];
  relatedTechnologyId: string;
  specs: LabelValueRecord[];
}

export interface PatentInfoRecord {
  /** Printed patent reference, e.g. "Patent Application No. 113754" (translated wording). */
  patentNumber: Localized;
  location: Localized;
  keyPoints: Localized[];
}

export interface TechnologyRecord extends RoutableBase {
  categoryNumber: string;
  categoryTitle: Localized;
  title: Localized;
  subtitle: Localized;
  overview: Localized;
  patentInfo: PatentInfoRecord | null;
  rawMaterials: Localized[];
  processPrinciples: TitleDescriptionRecord[];
  keyAdvantages: Localized[];
  applications: Localized[];
  productsProduced: Localized[];
  relatedProjectIds: string[];
  image: MediaRef;
}

export interface ProductRecord extends RoutableBase {
  categoryNumber: string;
  categoryTitle: Localized;
  title: Localized;
  description: Localized;
  rawMaterials: Localized[];
  productionTechnology: Localized;
  applications: Localized[];
  characteristics: Localized[];
  relatedTechnologyId: string;
  relatedProjectId: string;
  image: MediaRef;
}

export interface EpcmStageRecord extends EntityBase {
  /** Display number "01"…"08". */
  number: string;
  title: Localized;
  focus: Localized;
  description: Localized;
  deliverables: Localized[];
  image: MediaRef | null;
}

/**
 * Patent / patent application. Two sets of records exist in the approved site:
 * the four cards of the home IP section (`placements` contains "home") and the two
 * registry entries of /technologies/patents (`placements` contains "registry").
 * Fields that a placement does not use are null.
 */
export interface PatentRecord extends EntityBase {
  placements: ('home' | 'registry')[];
  /** Patent / application number as printed (structural, not translated). */
  patentNo: string;
  title: Localized;
  // home card fields
  /** Legal state (drives the badge style). */
  legalStatus: 'granted' | 'application' | null;
  statusLabel: Localized | null;
  patentLabel: Localized | null;
  jurisdiction: Localized | null;
  abstract: Localized | null;
  claimsSummary: Localized[] | null;
  // registry fields
  registryNumber: string | null;
  code: Localized | null;
  location: Localized | null;
  overview: Localized | null;
  keyPillars: TitleDescriptionRecord[] | null;
  industrialImplementation: Localized | null;
  image: MediaRef | null;
  imageCaption: Localized | null;
}

export interface VideoRecord extends EntityBase {
  number: string;
  category: Localized;
  title: Localized;
  headline: Localized;
  description: Localized;
  video: MediaRef;
  poster: MediaRef;
}

export interface OfficeRecord {
  id: string;
  order: number;
  region: Localized;
  title: Localized;
  country: Localized;
  address: Localized | null;
  representative: Localized | null;
  phone: string | null;
  email: string;
  whatsapp: string | null;
}

export interface MetricRecord {
  id: string;
  /** Value as printed, e.g. "25+" (null for text-only metrics). */
  value: string | null;
  /** Label; may contain "\n" line breaks and a {highlight} placeholder. */
  label: Localized;
  /** Text inserted (emphasised) at {highlight} in the label. */
  highlight: Localized | null;
}

export interface GlobalSettingsRecord {
  id: 'settings';
  translationStatus: TranslationStatus;
  siteName: string;
  primaryEmail: string;
  footerTagline: Localized;
  footerLocation: Localized;
  copyright: Localized;
  logo: MediaRef;
  logoReversed: MediaRef;
  footerBackground: MediaRef;
  footerBackgroundAlt: Localized;
  headquarters: {
    name: Localized;
    addressLine1: Localized;
    addressLine2: Localized;
    shortAddress: Localized;
    jurisdiction: Localized;
    hours: Localized;
    email: string;
  };
  metrics: MetricRecord[];
  offices: OfficeRecord[];
  defaultSeo: {
    siteTitle: Localized;
    siteDescription: Localized;
  };
}

/** Header block shared by every content page (rendered by <PageHeader>). */
export interface PageHeaderRecord {
  badgeNumber: string;
  badgeLabel: Localized;
  title: Localized;
  subtitle: Localized | null;
  description: Localized | null;
  meta: LabelValueRecord[];
  actionLabel: Localized | null;
}

/** Route keys of indexable pages (route patterns are frontend-owned, see src/content/routes.ts). */
export type PageRouteKey =
  | 'home'
  | 'company'
  | 'globalPresence'
  | 'technologies'
  | 'patents'
  | 'epcm'
  | 'products'
  | 'projects'
  | 'contact'
  | 'privacy'
  | 'terms';

/** Non-routable copy groups: shared texts of detail-page templates and site-wide blocks. */
export type TemplateKey = 'projectDetail' | 'technologyDetail' | 'productDetail';

export type PageKey = PageRouteKey | TemplateKey;

export type CopyMap = Record<string, Localized>;

/** A list item of a page list: string fields are Localized, everything else structural. */
export type PageListItemRecord = Record<string, unknown>;

export interface PageRecord extends EntityBase {
  key: PageKey;
  kind: 'page' | 'template';
  header: PageHeaderRecord | null;
  /** Fixed, named text slots of the page (headings, intros, paragraphs, CTA texts). */
  copy: CopyMap;
  /** Structured repeatable items of the page (e.g. home key directions, company timeline). */
  lists: Record<string, PageListItemRecord[]>;
  /** Named images of the page. */
  media: Record<string, MediaRef>;
  /** Rich body for legal pages (paragraph strings). Empty until client content is supplied. */
  body: Localized[] | null;
  seo: SeoRecord | null;
}

export interface RedirectRecord {
  id: string;
  /** Locale-less source path, e.g. "/old-page". */
  from: string;
  /** Locale-less target path. */
  to: string;
  statusCode: 301 | 302;
  /** Emit the redirect for every language prefix. */
  allLocales: boolean;
}

/** Everything the site renders, in stored (multilingual) form. */
export interface ContentStore {
  pages: PageRecord[];
  projects: ProjectRecord[];
  technologies: TechnologyRecord[];
  products: ProductRecord[];
  epcmStages: EpcmStageRecord[];
  patents: PatentRecord[];
  videos: VideoRecord[];
  media: MediaRecord[];
  settings: GlobalSettingsRecord;
  redirects: RedirectRecord[];
}
