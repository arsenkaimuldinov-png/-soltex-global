/**
 * The seven admin-managed translatable entities and their tables, in SQL names (Phase F).
 * Used by the translation queries (one UNION ALL over all types, no N+1) and by reconcile.ts.
 * Table and column names are constants of the code, never request data.
 */
export type TranslatableType = 'pages' | 'projects' | 'technologies' | 'products' | 'epcm-stages' | 'patents' | 'videos';

export const TRANSLATABLE_TYPES: readonly TranslatableType[] = ['pages', 'projects', 'technologies', 'products', 'epcm-stages', 'patents', 'videos'];

export interface ReviewTable {
  type: TranslatableType;
  /** Audit resource type (same as Phase E). */
  resourceType: string;
  /** Property of ContentStore holding the records. */
  storeKey: 'pages' | 'projects' | 'technologies' | 'products' | 'epcmStages' | 'patents' | 'videos';
  entity: string;
  tr: string;
  owner: string;
  /** SQL expression (alias t = source-language row, e = entity) giving the record title. */
  title: string;
}

export const REVIEW_TABLES: Readonly<Record<TranslatableType, ReviewTable>> = {
  pages: { type: 'pages', resourceType: 'page', storeKey: 'pages', entity: 'pages', tr: 'page_translations', owner: 'page_id', title: 'coalesce(t.header_title, e.page_key)' },
  projects: { type: 'projects', resourceType: 'project', storeKey: 'projects', entity: 'projects', tr: 'project_translations', owner: 'project_id', title: 't.title' },
  technologies: { type: 'technologies', resourceType: 'technology', storeKey: 'technologies', entity: 'technologies', tr: 'technology_translations', owner: 'technology_id', title: 't.title' },
  products: { type: 'products', resourceType: 'product', storeKey: 'products', entity: 'products', tr: 'product_translations', owner: 'product_id', title: 't.title' },
  'epcm-stages': { type: 'epcm-stages', resourceType: 'epcm_stage', storeKey: 'epcmStages', entity: 'epcm_stages', tr: 'epcm_stage_translations', owner: 'stage_id', title: 't.title' },
  patents: { type: 'patents', resourceType: 'patent', storeKey: 'patents', entity: 'patents', tr: 'patent_translations', owner: 'patent_id', title: 't.title' },
  videos: { type: 'videos', resourceType: 'video', storeKey: 'videos', entity: 'videos', tr: 'video_translations', owner: 'video_id', title: 't.title' },
};

// Guard for the raw SQL identifiers (Phase M-1, scripts/check-sql-raw.mjs): these names are spliced into
// SQL, so they must stay plain identifiers / a fixed expression of them.
for (const t of Object.values(REVIEW_TABLES))
  for (const v of [t.entity, t.tr, t.owner]) if (!/^[a-z_]+$/.test(v)) throw new Error(`review-tables: unsafe identifier ${v}`);
for (const t of Object.values(REVIEW_TABLES)) if (!/^[a-z_.(), ]+$/.test(t.title)) throw new Error(`review-tables: unsafe title expression ${t.title}`);
