/**
 * The six content collections of Phase E, described once (docs/admin-content.md §3). Each
 * description maps API field names to the Phase B tables; the service, the request/response
 * schemas and the OpenAPI document are all derived from it, so the editor of every type is typed
 * and exactly matches the stored content model (no generic page builder, no invented fields).
 *
 * Field names of SEO data are the names of @soltex/core/domain SEO_FIELDS (slug, seoMetaTitle,
 * seoMetaDescription, ogImage, noindex): field-level authorization uses them directly.
 */
import type { PgTable } from 'drizzle-orm/pg-core';
import type { RoutableType } from '@soltex/core/seo';
import * as s from '../../db/schema.ts';
import { LIMITS, type TrKind } from './fields.ts';

export type CollectionName = 'projects' | 'technologies' | 'products' | 'epcm-stages' | 'patents' | 'videos';
export const COLLECTIONS: readonly CollectionName[] = ['projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos'];

export type EnKind = 'string' | 'stringNull' | 'bool' | 'media' | 'mediaNull' | 'ref' | 'enumNull' | 'placements' | 'mediaList' | 'refList';

export interface TrFieldDef {
  name: string;
  kind: TrKind;
  /** Property of the drizzle translation table. */
  column: string;
  max?: number;
}

export interface EnFieldDef {
  name: string;
  kind: EnKind;
  /** Property of the drizzle entity table (not used by child lists). */
  column?: string;
  mediaKind?: 'image' | 'video';
  ref?: 'technologies' | 'projects';
  values?: readonly string[];
  max?: number;
}

export interface CollectionDef {
  name: CollectionName;
  /** Audit resource type. */
  resourceType: string;
  /** Prefix of generated stable keys ("project-<slug>"). */
  keyPrefix: string;
  /** Routable types have a slug (one per entity, all languages) and SEO data. */
  routable: RoutableType | null;
  table: PgTable & Record<string, unknown>;
  trTable: PgTable & Record<string, unknown>;
  /** Property of the translation table that points to the entity. */
  trOwner: string;
  /** Translated field shown as the record title. */
  titleField: string;
  en: readonly EnFieldDef[];
  tr: readonly TrFieldDef[];
}

const line = LIMITS.line;
const seoTr: TrFieldDef[] = [
  { name: 'seoMetaTitle', kind: 'textNull', column: 'seoMetaTitle', max: 200 },
  { name: 'seoMetaDescription', kind: 'textNull', column: 'seoMetaDescription', max: 400 },
];
const seoEn: EnFieldDef[] = [
  { name: 'ogImage', kind: 'mediaNull', column: 'ogImageId', mediaKind: 'image' },
  { name: 'noindex', kind: 'bool', column: 'noindex' },
];

const T = (t: unknown) => t as PgTable & Record<string, unknown>;

export const COLLECTION_DEFS: Readonly<Record<CollectionName, CollectionDef>> = {
  projects: {
    name: 'projects',
    resourceType: 'project',
    keyPrefix: 'project',
    routable: 'project',
    table: T(s.projects),
    trTable: T(s.projectTranslations),
    trOwner: 'projectId',
    titleField: 'title',
    en: [
      { name: 'categoryNumber', kind: 'string', column: 'categoryNumber', max: 10 },
      { name: 'image', kind: 'media', column: 'imageId', mediaKind: 'image' },
      { name: 'imagePosition', kind: 'stringNull', column: 'imagePosition', max: 40 },
      { name: 'gallery', kind: 'mediaList', mediaKind: 'image' },
      { name: 'relatedTechnology', kind: 'ref', column: 'relatedTechnologyId', ref: 'technologies' },
      ...seoEn,
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'category', kind: 'text', column: 'category', max: line },
      { name: 'country', kind: 'text', column: 'country', max: line },
      { name: 'years', kind: 'text', column: 'years', max: 60 },
      { name: 'capacity', kind: 'textNull', column: 'capacity', max: line },
      { name: 'type', kind: 'text', column: 'type', max: line },
      { name: 'overview', kind: 'text', column: 'overview' },
      { name: 'scope', kind: 'list', column: 'scope' },
      { name: 'technology', kind: 'text', column: 'technology' },
      { name: 'results', kind: 'listNull', column: 'results' },
      { name: 'specs', kind: 'labelValue', column: 'specs' },
      ...seoTr,
    ],
  },
  technologies: {
    name: 'technologies',
    resourceType: 'technology',
    keyPrefix: 'technology',
    routable: 'technology',
    table: T(s.technologies),
    trTable: T(s.technologyTranslations),
    trOwner: 'technologyId',
    titleField: 'title',
    en: [
      { name: 'categoryNumber', kind: 'string', column: 'categoryNumber', max: 10 },
      { name: 'image', kind: 'media', column: 'imageId', mediaKind: 'image' },
      { name: 'relatedProjects', kind: 'refList', ref: 'projects' },
      ...seoEn,
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'categoryTitle', kind: 'text', column: 'categoryTitle', max: line },
      { name: 'subtitle', kind: 'text', column: 'subtitle', max: line },
      { name: 'overview', kind: 'text', column: 'overview' },
      { name: 'patentInfo', kind: 'patentInfo', column: 'patentInfo' },
      { name: 'rawMaterials', kind: 'list', column: 'rawMaterials' },
      { name: 'processPrinciples', kind: 'titleDesc', column: 'processPrinciples' },
      { name: 'keyAdvantages', kind: 'list', column: 'keyAdvantages' },
      { name: 'applications', kind: 'list', column: 'applications' },
      { name: 'productsProduced', kind: 'list', column: 'productsProduced' },
      ...seoTr,
    ],
  },
  products: {
    name: 'products',
    resourceType: 'product',
    keyPrefix: 'product',
    routable: 'product',
    table: T(s.products),
    trTable: T(s.productTranslations),
    trOwner: 'productId',
    titleField: 'title',
    en: [
      { name: 'categoryNumber', kind: 'string', column: 'categoryNumber', max: 10 },
      { name: 'image', kind: 'media', column: 'imageId', mediaKind: 'image' },
      { name: 'relatedTechnology', kind: 'ref', column: 'relatedTechnologyId', ref: 'technologies' },
      { name: 'relatedProject', kind: 'ref', column: 'relatedProjectId', ref: 'projects' },
      ...seoEn,
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'categoryTitle', kind: 'text', column: 'categoryTitle', max: line },
      { name: 'description', kind: 'text', column: 'description' },
      { name: 'rawMaterials', kind: 'list', column: 'rawMaterials' },
      { name: 'productionTechnology', kind: 'text', column: 'productionTechnology' },
      { name: 'applications', kind: 'list', column: 'applications' },
      { name: 'characteristics', kind: 'list', column: 'characteristics' },
      ...seoTr,
    ],
  },
  'epcm-stages': {
    name: 'epcm-stages',
    resourceType: 'epcm_stage',
    keyPrefix: 'epcm-stage',
    routable: null,
    table: T(s.epcmStages),
    trTable: T(s.epcmStageTranslations),
    trOwner: 'stageId',
    titleField: 'title',
    en: [
      { name: 'number', kind: 'string', column: 'number', max: 10 },
      { name: 'image', kind: 'mediaNull', column: 'imageId', mediaKind: 'image' },
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'focus', kind: 'text', column: 'focus', max: line },
      { name: 'description', kind: 'text', column: 'description' },
      { name: 'deliverables', kind: 'list', column: 'deliverables' },
    ],
  },
  patents: {
    name: 'patents',
    resourceType: 'patent',
    keyPrefix: 'patent',
    routable: null,
    table: T(s.patents),
    trTable: T(s.patentTranslations),
    trOwner: 'patentId',
    titleField: 'title',
    en: [
      { name: 'placements', kind: 'placements', column: 'placements', values: ['home', 'registry'] },
      { name: 'patentNo', kind: 'string', column: 'patentNo', max: 60 },
      { name: 'legalStatus', kind: 'enumNull', column: 'legalStatus', values: ['granted', 'application'] },
      { name: 'registryNumber', kind: 'stringNull', column: 'registryNumber', max: 60 },
      { name: 'image', kind: 'mediaNull', column: 'imageId', mediaKind: 'image' },
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'statusLabel', kind: 'textNull', column: 'statusLabel', max: line },
      { name: 'patentLabel', kind: 'textNull', column: 'patentLabel', max: line },
      { name: 'jurisdiction', kind: 'textNull', column: 'jurisdiction', max: line },
      { name: 'abstract', kind: 'textNull', column: 'abstract' },
      { name: 'claimsSummary', kind: 'listNull', column: 'claimsSummary' },
      { name: 'code', kind: 'textNull', column: 'code', max: line },
      { name: 'location', kind: 'textNull', column: 'location', max: line },
      { name: 'overview', kind: 'textNull', column: 'overview' },
      { name: 'keyPillars', kind: 'titleDescNull', column: 'keyPillars' },
      { name: 'industrialImplementation', kind: 'textNull', column: 'industrialImplementation' },
      { name: 'imageCaption', kind: 'textNull', column: 'imageCaption', max: line },
    ],
  },
  videos: {
    name: 'videos',
    resourceType: 'video',
    keyPrefix: 'video',
    routable: null,
    table: T(s.videos),
    trTable: T(s.videoTranslations),
    trOwner: 'videoId',
    titleField: 'title',
    en: [
      { name: 'number', kind: 'string', column: 'number', max: 10 },
      { name: 'video', kind: 'media', column: 'videoId', mediaKind: 'video' },
      { name: 'poster', kind: 'media', column: 'posterId', mediaKind: 'image' },
    ],
    tr: [
      { name: 'title', kind: 'text', column: 'title', max: line },
      { name: 'category', kind: 'text', column: 'category', max: line },
      { name: 'headline', kind: 'text', column: 'headline', max: line },
      { name: 'description', kind: 'text', column: 'description' },
    ],
  },
};

/**
 * Fields a new draft needs: its title and what the database cannot store empty (required media,
 * required relations, patent placements). Every other field starts empty and is filled in the
 * editor; completeness is checked when publishing (Phase G), not when saving a draft.
 */
export const requiredOnCreate = (def: CollectionDef): string[] => [
  def.titleField,
  ...def.en.filter((f) => f.kind === 'media' || f.kind === 'ref' || f.kind === 'placements').map((f) => f.name),
];
