/**
 * Content getters — the only API page components use to read content.
 *
 * Built from one language's ContentSnapshot. Framework-free (also used by SEO generation and
 * prerendering). React access goes through `useContent()` / `usePage()` in ./useContent.ts.
 */
import React from 'react';
import type {
  ContentSnapshot,
  EpcmStage,
  GlobalSettings,
  MediaAsset,
  Page,
  PageKey,
  Patent,
  Product,
  Project,
  Technology,
  Video,
} from './types';

export type CopyParams = Record<string, string | number>;

export class MissingContentError extends Error {}

/** Replace {name} placeholders. */
export function interpolate(template: string, params?: CopyParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/** Replace {name} placeholders with React nodes (word order may differ per language). */
export function interpolateNodes(template: string, nodes: Record<string, React.ReactNode>): React.ReactNode {
  const parts = template.split(/\{(\w+)\}/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? React.createElement(React.Fragment, { key: i }, nodes[part] ?? `{${part}}`) : part
  );
}

function indexBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T> {
  return new Map(items.map((i) => [i[key], i]));
}

export interface PageAccessor {
  page: Page;
  header: Page['header'];
  /** Text slot of the page. Throws when the key does not exist (caught by prerendering). */
  c: (key: string, params?: CopyParams) => string;
  /** Text slot with inline React elements in place of {placeholders}. */
  cr: (key: string, nodes: Record<string, React.ReactNode>) => React.ReactNode;
  /** Structured list of the page. */
  list: <T = Record<string, unknown>>(name: string) => T[];
  /** Named image of the page. */
  media: (name: string) => MediaAsset;
}

export function createPageAccessor(page: Page): PageAccessor {
  const text = (key: string) => {
    const value = page.copy[key];
    if (typeof value !== 'string') throw new MissingContentError(`Missing copy "${page.key}.${key}"`);
    return value;
  };
  return {
    page,
    header: page.header,
    c: (key, params) => interpolate(text(key), params),
    cr: (key, nodes) => interpolateNodes(text(key), nodes),
    list: <T,>(name: string) => {
      const items = page.lists[name];
      if (!items) throw new MissingContentError(`Missing list "${page.key}.${name}"`);
      return items as unknown as T[];
    },
    media: (name) => {
      const m = page.media[name];
      if (!m) throw new MissingContentError(`Missing media "${page.key}.${name}"`);
      return m;
    },
  };
}

export interface ContentApi {
  snapshot: ContentSnapshot;
  settings: GlobalSettings;
  hasPage: (key: PageKey) => boolean;
  page: (key: PageKey) => PageAccessor;
  projects: Project[];
  project: (slug: string) => Project | undefined;
  projectById: (id: string) => Project | undefined;
  technologies: Technology[];
  technology: (slug: string) => Technology | undefined;
  technologyById: (id: string) => Technology | undefined;
  products: Product[];
  product: (slug: string) => Product | undefined;
  productById: (id: string) => Product | undefined;
  epcmStages: EpcmStage[];
  patents: (placement: 'home' | 'registry') => Patent[];
  videos: Video[];
}

export function createContentApi(snapshot: ContentSnapshot): ContentApi {
  const pages = indexBy(snapshot.pages, 'key');
  const accessors = new Map<PageKey, PageAccessor>();
  const projectsBySlug = indexBy(snapshot.projects, 'slug');
  const projectsById = indexBy(snapshot.projects, 'id');
  const techBySlug = indexBy(snapshot.technologies, 'slug');
  const techById = indexBy(snapshot.technologies, 'id');
  const prodBySlug = indexBy(snapshot.products, 'slug');
  const prodById = indexBy(snapshot.products, 'id');

  return {
    snapshot,
    settings: snapshot.settings,
    hasPage: (key) => pages.has(key),
    page: (key) => {
      let acc = accessors.get(key);
      if (!acc) {
        const p = pages.get(key);
        if (!p) throw new MissingContentError(`Missing page "${key}"`);
        acc = createPageAccessor(p);
        accessors.set(key, acc);
      }
      return acc;
    },
    projects: snapshot.projects,
    project: (slug) => projectsBySlug.get(slug),
    projectById: (id) => projectsById.get(id),
    technologies: snapshot.technologies,
    technology: (slug) => techBySlug.get(slug),
    technologyById: (id) => techById.get(id),
    products: snapshot.products,
    product: (slug) => prodBySlug.get(slug),
    productById: (id) => prodById.get(id),
    epcmStages: snapshot.epcmStages,
    patents: (placement) => snapshot.patents.filter((p) => p.placements.includes(placement)),
    videos: snapshot.videos,
  };
}
