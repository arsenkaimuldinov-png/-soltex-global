/**
 * Page slot registry (review §G): the code-owned structure of every fixed page and detail-page
 * template. The CMS edits the DATA of these slots; it never adds, removes or renames them
 * (no page builder). The site reads the same slot keys (apps/web, `page.c('<slot>')`).
 *
 * Per page:
 *  - `slots`: text slots in order. `multiline` = edited as a paragraph field. `placeholders` =
 *    `{name}` values the site fills in at render time; an edited text must keep exactly this set.
 *  - `lists`: repeatable items of the page; the CMS edits their texts (`texts` = text paths of an
 *    item), not their number or structure.
 *  - `media`: named images of the page.
 *  - `header`: the page has the shared page header block; `body`: legal pages with paragraphs;
 *    `seo`: the page is indexable and has SEO texts.
 *
 * A test (packages/core/test/page-registry.test.ts) checks this registry against the seed, so the
 * registry, the database and the site can never drift apart silently.
 */
import type { PageKey } from './store.ts';

export interface SlotDef {
  key: string;
  multiline: boolean;
  placeholders: readonly string[];
}

export interface PageDef {
  kind: 'page' | 'template';
  header: boolean;
  body: boolean;
  seo: boolean;
  slots: readonly SlotDef[];
  lists: Readonly<Record<string, { texts: readonly string[] }>>;
  media: readonly string[];
}

const s = (key: string, multiline = false, placeholders: readonly string[] = []): SlotDef => ({ key, multiline, placeholders });

export const PAGE_REGISTRY: Readonly<Record<PageKey, PageDef>> = {
  home: {
    kind: 'page',
    header: false,
    body: false,
    seo: true,
    slots: [
      s('allProjectsCta'),
      s('allProjectsText', true),
      s('allProjectsTitle', true),
      s('epcmHeading', true),
      s('epcmIntro', true),
      s('epcmLink'),
      s('heroHeadlineLine1'),
      s('heroHeadlineLine2'),
      s('heroHeadlineLine3'),
      s('heroImageAlt'),
      s('heroSecondaryCta'),
      s('ipHeading', true),
      s('ipIntro', true),
      s('ipLink'),
      s('technologiesHeading'),
      s('videosHeading'),
      s('heroEyebrow'),
      s('heroDescription', true),
      s('heroUsp', true),
    ],
    lists: {
      heroTags: { texts: ['label'] },
      keyDirections: { texts: ['title', 'subtitle', 'description'] },
    },
    media: ['heroImage'],
  },
  company: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('capabilitiesEyebrow'),
      s('capabilitiesHeading'),
      s('capabilitiesIntro', true),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('epcmEyebrow'),
      s('epcmImageAlt'),
      s('epcmLink'),
      s('epcmTitle'),
      s('hygienicCompliance'),
      s('hygienicEyebrow'),
      s('hygienicImageAlt'),
      s('hygienicText', true),
      s('hygienicTitle'),
      s('mandateEyebrow'),
      s('mandateHeading'),
      s('mandateParagraph1', true),
      s('mandateParagraph2', true),
      s('mandateProjectsLink'),
      s('mandateTechnologiesLink'),
      s('provenanceEyebrow'),
      s('provenanceImageAlt'),
      s('provenanceNote', true),
      s('provenanceTitle'),
      s('purityLabel'),
      s('purityValue'),
      s('recoveryLabel'),
      s('recoveryValue'),
      s('timelineEyebrow'),
      s('timelineHeading'),
      s('timelineIntro', true),
      s('inquiryTopic'),
    ],
    lists: {
      capabilities: { texts: ['title', 'description'] },
      timeline: { texts: ['year', 'title', 'description'] },
    },
    media: ['provenanceImage', 'hygienicImage', 'epcmImage'],
  },
  globalPresence: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('corridorsEyebrow'),
      s('corridorsHeading'),
      s('corridorsParagraph1', true),
      s('corridorsParagraph2', true),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('headquartersEyebrow'),
      s('headquartersText', true),
      s('site1Region'),
      s('site1Text', true),
      s('site1Title'),
      s('site2Region'),
      s('site2Text', true),
      s('site2Title'),
      s('site3Region'),
      s('site3Text', true),
      s('site3Title'),
      s('site4Region'),
      s('site4Text', true),
      s('site4Title'),
      s('sitesEyebrow'),
      s('sitesHeading'),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  technologies: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('patentRegistryLink'),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  patents: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('assurance1Text', true),
      s('assurance1Title'),
      s('assurance2Text', true),
      s('assurance2Title'),
      s('assurance3Text', true),
      s('assurance3Title'),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('registryEyebrow'),
      s('registryHeading'),
      s('statusValue'),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  epcm: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('guaranteeEyebrow'),
      s('guaranteeItem1'),
      s('guaranteeItem2'),
      s('guaranteeItem3'),
      s('guaranteeItem4'),
      s('guaranteeTitle'),
      s('philosophyEyebrow'),
      s('philosophyHeading'),
      s('philosophyParagraph1', true),
      s('philosophyParagraph2', true),
      s('workflowEyebrow'),
      s('workflowHeading'),
      s('workflowIntro', true),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  products: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('listNote', true),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  projects: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle'),
      s('listNote', true),
      s('stat1Label'),
      s('stat1Note', true),
      s('stat1Value'),
      s('stat2Label'),
      s('stat2Note', true),
      s('stat2Value'),
      s('stat3Label'),
      s('stat3Note', true),
      s('stat3Value'),
      s('stat4Label'),
      s('stat4Note', true),
      s('stat4Value'),
      s('inquiryTopic'),
    ],
    lists: {},
    media: [],
  },
  contact: {
    kind: 'page',
    header: true,
    body: false,
    seo: true,
    slots: [
      s('headquartersEyebrow'),
      s('ipText', true),
      s('ipTitle'),
      s('officesEyebrow'),
    ],
    lists: {},
    media: [],
  },
  privacy: {
    kind: 'page',
    header: true,
    body: true,
    seo: true,
    slots: [],
    lists: {},
    media: [],
  },
  terms: {
    kind: 'page',
    header: true,
    body: true,
    seo: true,
    slots: [],
    lists: {},
    media: [],
  },
  projectDetail: {
    kind: 'template',
    header: false,
    body: false,
    seo: false,
    slots: [
      s('archiveEyebrow'),
      s('archiveImageAlt'),
      s('archiveTitle'),
      s('badgeLabel', false, ['category']),
      s('capacityFallback'),
      s('certificationText', true),
      s('certificationTitle'),
      s('contextEyebrow'),
      s('contextHeading'),
      s('contextParagraph', true),
      s('contractScopeValue'),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle', false, ['title']),
      s('galleryEyebrow'),
      s('galleryHeading'),
      s('headerActionLabel'),
      s('headerInquiryTopic', false, ['title']),
      s('resultsEyebrow'),
      s('resultsHeading'),
      s('scopeEyebrow'),
      s('scopeHeading'),
      s('technologyEyebrow'),
      s('technologyHeading', false, ['technology']),
      s('technologyParagraph', true),
    ],
    lists: {},
    media: ['archiveBandImage'],
  },
  technologyDetail: {
    kind: 'template',
    header: false,
    body: false,
    seo: false,
    slots: [
      s('advantagesEyebrow'),
      s('advantagesHeading'),
      s('applicationsEyebrow'),
      s('applicationsHeading'),
      s('badgeLabel', false, ['category']),
      s('bandCaption'),
      s('bandImageAlt'),
      s('bandTag'),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle', false, ['title']),
      s('efficiencyValue'),
      s('facilitiesEyebrow'),
      s('facilitiesHeading'),
      s('feedstockFallback'),
      s('headerActionLabel'),
      s('headerInquiryTopic', false, ['title']),
      s('heroEyebrow'),
      s('patentFallback'),
      s('principlesEyebrow'),
      s('principlesHeading'),
      s('statusValue'),
    ],
    lists: {},
    media: ['bandImage'],
  },
  productDetail: {
    kind: 'template',
    header: false,
    body: false,
    seo: false,
    slots: [
      s('applicationsEyebrow'),
      s('applicationsHeading'),
      s('badgeLabel', false, ['category']),
      s('characteristicsEyebrow'),
      s('characteristicsHeading'),
      s('complianceValue'),
      s('ctaBadge'),
      s('ctaDescription', true),
      s('ctaTitle', false, ['title']),
      s('feedstockFallback'),
      s('headerActionLabel'),
      s('headerInquiryTopic', false, ['title']),
      s('imageTag'),
      s('packagingValue'),
      s('provenanceEyebrow'),
      s('purityFallback'),
      s('regulatoryValue'),
      s('shelfLifeValue'),
      s('subtitle'),
    ],
    lists: {},
    media: [],
  },
};

export const PAGE_KEYS = Object.keys(PAGE_REGISTRY) as PageKey[];

/** `{name}` placeholders of a text, in order of appearance, without duplicates. */
export function placeholdersOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
}

/** True when `text` uses exactly the placeholders the site fills in for this slot. */
export function placeholdersMatch(slot: SlotDef, text: string): boolean {
  const found = placeholdersOf(text);
  return found.length === slot.placeholders.length && slot.placeholders.every((p) => found.includes(p));
}
