/**
 * Per-route SEO metadata (title, description, canonical, hreflang) for every locale.
 *
 * Framework-free on purpose: it is used both by the React <SeoHead> component at runtime
 * and by scripts/prerender.ts, which writes a static HTML shell per route and language so
 * crawlers see the correct <html lang>, <title>, meta description, canonical and hreflang
 * without executing JavaScript.
 *
 * All titles and descriptions are taken from copy that already exists on the page
 * (page headings and header descriptions). No new marketing copy is introduced here.
 */
import { DEFAULT_LOCALE, LOCALES, Locale, SITE_URL, getLocaleInfo } from './config';
import { localizePath } from './paths';
import { PROJECTS_DATA, TECHNOLOGIES_DATA, PRODUCTS_DATA } from '../data/pagesData';

export type Translator = (input: string) => string;

export interface RouteMeta {
  title: string;
  description: string;
  indexable: boolean;
}

const BRAND = 'Soltex Global';

/** Home page — identical to the original index.html title/description. */
const HOME_TITLE = 'Soltex Global — Turnkey Engineering for Advanced Plant Processing';
const HOME_DESCRIPTION =
  'International EPC / EPCM engineering group delivering industrial processing plants for high-value ingredients, pectin, dietary fibers, and functional plant proteins.';

/** Static pages: heading (H1) and header description exactly as rendered by each page. */
const STATIC_PAGES: Record<string, { heading: string; description: string }> = {
  '/company': {
    heading: 'Engineering Technological Sovereignty in Agro-Processing',
    description:
      'Soltex Global is an international engineering and EPC enterprise specializing in deep agro-industrial processing. We develop proprietary patented extraction processes and deliver turnkey manufacturing plants that transform plant raw materials into high-margin functional proteins, pectins, and bioactive ingredients.',
  },
  '/company/global-presence': {
    heading: 'Global Industrial Presence & Regional Hubs',
    description:
      'Soltex Global coordinates multi-national turnkey projects from our corporate engineering headquarters in the United Arab Emirates, backed by regional offices, certified fabrication partners, and operational facilities across Israel, China, Uzbekistan, and Eurasia.',
  },
  '/technologies': {
    heading: 'Patented Agro-Processing Technologies',
    description:
      'Soltex Global develops, patents, and licenses comprehensive industrial process technologies. From zero-waste closed-loop pectin extraction to solvent-free soy protein isolates and pure inulin crystal recovery, our flowsheet designs guarantee market-leading purity, high recovery coefficients, and low operating costs.',
  },
  '/technologies/patents': {
    heading: 'Patents, Scientific IP & Licensing',
    description:
      "Soltex Global safeguards its clients' market exclusivity through registered international patents and trade secrets covering extraction yields, enzymatic fractionation, and closed-loop biomass valorization.",
  },
  '/epcm': {
    heading: 'Full-Cycle EPCM Industrial Services',
    description:
      'Soltex Global delivers complex deep agro-processing installations under unified Engineering, Procurement, Construction Management (EPCM) and turnkey EPC models. We assume total technical responsibility from biomass testing to operational yield guarantees.',
  },
  '/products': {
    heading: 'High-Value Plant Ingredients & Biochemical Outputs',
    description:
      'The tangible output of our engineering prowess. Soltex Global facilities produce world-standard functional proteins, pectins, and prebiotics serving global food manufacturers, nutraceutical producers, and pharmaceutical enterprises.',
  },
  '/projects': {
    heading: 'Industrial Projects & Turnkey Facilities',
    description:
      'Factual overview of completed and operational industrial plants delivered across Israel, China, Uzbekistan, and Eurasia. Every project reflects certified engineering, patented extraction protocols, and verified operational capacities.',
  },
  '/contact': {
    heading: 'Engineering Inquiries & Global Representation',
    description:
      'Connect with our central engineering bureau in the UAE or our regional project offices in Israel, China, Bulgaria, and Eurasia. All technical consultations are conducted under mutual non-disclosure protocols.',
  },
};

/** Every indexable locale-less path, including all detail pages. */
export function getAllRoutePaths(): string[] {
  return [
    '/',
    ...Object.keys(STATIC_PAGES),
    ...TECHNOLOGIES_DATA.map((t) => `/technologies/${t.slug}`),
    ...PRODUCTS_DATA.map((p) => `/products/${p.slug}`),
    ...PROJECTS_DATA.map((p) => `/projects/${p.slug}`),
  ];
}

/**
 * Shorten a (translated) description to whole sentences, ~160 characters.
 * Never cuts a sentence in half, so no wording is altered — only trailing sentences are omitted.
 */
export function summarize(text: string, max = 160): string {
  const sentences = text.match(/[^.!?。！？؟]+[.!?。！？؟]*\s*/g) ?? [text];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).trim().length > max) break;
    out += s;
  }
  return out.trim();
}

const withBrand = (title: string) => `${title} | ${BRAND}`;

export function getRouteMeta(path: string, t: Translator): RouteMeta {
  if (path === '/') {
    return { title: t(HOME_TITLE), description: t(HOME_DESCRIPTION), indexable: true };
  }

  const page = STATIC_PAGES[path];
  if (page) {
    return {
      title: withBrand(t(page.heading)),
      description: summarize(t(page.description)),
      indexable: true,
    };
  }

  const [, section, slug] = path.split('/');
  if (section === 'technologies') {
    const tech = TECHNOLOGIES_DATA.find((x) => x.slug === slug);
    if (tech) return { title: withBrand(t(tech.title)), description: summarize(t(tech.overview)), indexable: true };
  }
  if (section === 'products') {
    const prod = PRODUCTS_DATA.find((x) => x.slug === slug);
    if (prod) return { title: withBrand(t(prod.title)), description: summarize(t(prod.description)), indexable: true };
  }
  if (section === 'projects') {
    const proj = PROJECTS_DATA.find((x) => x.slug === slug);
    if (proj) return { title: withBrand(t(proj.title)), description: summarize(t(proj.overview)), indexable: true };
  }

  // Unknown URL: the app renders its fallback; keep it out of the index.
  return { title: t(HOME_TITLE), description: t(HOME_DESCRIPTION), indexable: false };
}

export const absoluteUrl = (path: string, locale: Locale) => `${SITE_URL}${localizePath(path, locale)}`;

export interface AlternateLink {
  hreflang: string;
  href: string;
}

/** hreflang alternates for a locale-less path, including x-default (English). */
export function getAlternates(path: string): AlternateLink[] {
  return [
    ...LOCALES.map((l) => ({ hreflang: l.htmlLang, href: absoluteUrl(path, l.code) })),
    { hreflang: 'x-default', href: absoluteUrl(path, DEFAULT_LOCALE) },
  ];
}

export const htmlLangOf = (locale: Locale) => getLocaleInfo(locale).htmlLang;
