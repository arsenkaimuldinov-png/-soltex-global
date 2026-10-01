/**
 * Content that was hard-coded inside React components before Phase 1, moved here verbatim
 * so the one-off migration (migrate-legacy.ts) can write it into the content seed.
 * This file is NOT used by the website at run time.
 */

// ---------------------------------------------------------------------------
// src/components/IntellectualProperty.tsx — home "Technology & IP" patent cards
// ---------------------------------------------------------------------------
export interface PatentCard {
  id: string;
  status: 'PATENT GRANTED' | 'PATENT APPLICATION';
  title: string;
  patentNo: string;
  patentLabel: 'Patent No.' | 'Application No.';
  jurisdiction: string;
  abstract: string;
  claimsSummary: string[];
}

export const HOME_PATENT_CARDS: PatentCard[] = [
  {
    id: 'apple-pectin',
    status: 'PATENT GRANTED',
    title: 'APPLE PECTIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 66235 B1',
    patentLabel: 'Patent No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Proprietary alcohol-free extraction process and system for high-gelling apple pectin from fresh and dried apple pomace with closed-loop acid recovery.',
    claimsSummary: [
      'Acid-free and alcohol-free hydro-thermal extraction',
      'Ultrafiltration membrane concentration at low thermal stress',
      'High methoxyl esterification preservation (DM > 68%)'
    ]
  },
  {
    id: 'citrus-pectin',
    status: 'PATENT GRANTED',
    title: 'CITRUS PECTIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 63596 B1',
    patentLabel: 'Patent No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Continuous counter-current extraction method for obtaining pharmaceutical and food grade pectin from orange, lemon and grapefruit peels.',
    claimsSummary: [
      'Continuous diffusion extractor with dynamic pH regulation',
      'Integrated essential oil and terpene recovery pre-treatment',
      'Low chemical consumption and reduced effluent volume'
    ]
  },
  {
    id: 'soy-protein',
    status: 'PATENT APPLICATION',
    title: 'SOY PROTEIN ISOLATE PRODUCTION TECHNOLOGY',
    patentNo: 'BG 114363 A1',
    patentLabel: 'Application No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Novel isoelectric precipitation and membrane filtration line yielding neutral-flavor, high-dispersibility soy protein isolate (≥90% protein dry basis).',
    claimsSummary: [
      'Multi-stage aqueous alkaline extraction and decanter separation',
      'Cross-flow ultrafiltration / diafiltration protein fractionation',
      'Flash pasteurization and high-yield gentle spray atomization'
    ]
  },
  {
    id: 'inulin',
    status: 'PATENT APPLICATION',
    title: 'INULIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 114364 A1',
    patentLabel: 'Application No.',
    jurisdiction: 'Bulgaria',
    abstract: 'High-purity fructan and inulin extraction system from Jerusalem artichoke tubers and chicory roots without harsh chemical decolorization.',
    claimsSummary: [
      'Pulsed electric or cavitation-assisted cell disruption',
      'Continuous chromatographic fractionation for controlled DP spectrum',
      'Crystallization with minimal mother-liquor waste'
    ]
  }
];


// ---------------------------------------------------------------------------
// Page lists / images that were inline in page components (EN source copy, verbatim)
// ---------------------------------------------------------------------------

/** src/pages/AboutPage.tsx — "02 · Core capabilities" cards (icons stay in the component). */
export const COMPANY_CAPABILITIES = [
  {
    title: 'Patented IP',
    description: 'Proprietary patents in aqueous extraction, cavitation pectin recovery, and closed-loop process cycles.'
  },
  {
    title: 'Turnkey EPCM',
    description: 'Single-point execution encompassing feedstock assay, 3D BIM design, custom fabrication, civil erection, and commissioning.'
  },
  {
    title: 'Yield Guarantees',
    description: 'Performance-backed contracts guaranteeing target yields, active compound purity, and energy efficiency ceilings.'
  },
  {
    title: 'Global Footprint',
    description: 'Headquartered in the UAE with reference plants operating across Israel, China, Uzbekistan, and Eurasia.'
  }
];

/** Named images of pages: page key → slot → file. */
export const PAGE_MEDIA: Record<string, Record<string, string>> = {
  home: {
    heroImage: '/images/hero_soltex_panoramic_plant_1790270267701.jpg',
  },
  company: {
    provenanceImage: '/images/hero_industrial_plant_1790267866540.jpg',
    hygienicImage: '/images/tech_integrated_plant_1790271239031.jpg',
    epcmImage: '/images/video_epcm_facility_1790267893198.jpg',
  },
};

/** src/pages/EpcmPage.tsx — illustration per EPCM stage number. */
export const EPCM_STAGE_IMAGES: Record<string, string> = {
  '01': '/images/tech_lab_flasks_1790271257443.jpg',
  '02': '/images/tech_citrus_oranges_1790271213504.jpg',
  '03': '/images/tech_integrated_plant_1790271239031.jpg',
  '04': '/images/video_epcm_facility_1790267893198.jpg',
  '05': '/images/video_plant_processing_1790267879744.jpg',
  '06': '/images/hero_plant_pristine_1790269454820.jpg',
  '07': '/images/flagship_siberian_wellness_1790267904663.jpg',
  '08': '/images/hero_industrial_plant_1790267866540.jpg'
};

/** src/pages/PatentsPage.tsx — plant photo per registry patent (index aligned with PATENTS_DATA). */
export const PATENT_IMAGERY = [
  {
    image: '/images/flagship_siberian_wellness_1790267904663.jpg',
    caption: 'Namangan Pectin Processing Complex (1,000 t/y output operating under Patent No. 113754)'
  },
  {
    image: '/images/project_soy_israel_1790271724797.jpg',
    caption: 'Industrial Soy Protein Isolate Complex (17,000 t/y operating under Patent RU 2709384 C1)'
  }
];

/** src/i18n/seo.ts — home page title/description (identical to the original index.html). */
export const HOME_TITLE = 'Soltex Global — Turnkey Engineering for Advanced Plant Processing';
export const HOME_DESCRIPTION =
  'International EPC / EPCM engineering group delivering industrial processing plants for high-value ingredients, pectin, dietary fibers, and functional plant proteins.';

/** src/components/MetricRibbon.tsx — metric values and labels (icons stay in the component). */
export const METRICS = [
  { id: 'metric-experience', value: '25+', label: 'YEARS OF\nINDUSTRIAL\nEXPERIENCE', highlight: null },
  { id: 'metric-countries', value: '10+', label: 'COUNTRIES\nPROJECT\nEXPERIENCE', highlight: null },
  { id: 'metric-technology', value: '20+', label: 'YEARS OF\nTECHNOLOGY\nIN OPERATION', highlight: null },
  { id: 'metric-projects', value: '300+', label: 'MILLION USD\nPROJECTS\nDELIVERED', highlight: null },
  // label was "FULL-CYCLE\n{epc}\nSOLUTIONS"; the placeholder is renamed to {highlight}
  { id: 'metric-epcm', value: null, label: 'FULL-CYCLE\n{epc}\nSOLUTIONS', highlight: 'EPC / EPCM' },
];

/** Site-wide texts that were hard-coded in Footer / Contact / Global Presence / CTA section. */
export const SETTINGS_TEXT = {
  siteName: 'Soltex Global',
  primaryEmail: 'info@soltexglobal.co',
  footerTagline: 'Engineering & technology partner for advanced plant processing facilities worldwide.',
  footerLocation: 'Sharjah Media City (Shams), UAE',
  copyright: '© 2024 Soltex Global. All rights reserved.',
  footerBackgroundAlt: 'Lush green botanical leaves texture',
  logo: '/images/soltex-global-logo-transparent.png',
  logoReversed: '/images/soltex-global-logo-reversed.png',
  footerBackground: '/images/footer_lush_botanical_1790272735218.jpg',
  headquarters: {
    name: 'Soltex Global FZC',
    addressLine1: 'Sharjah Media City (Shams)',
    addressLine2: 'Al Messaned, Sharjah, United Arab Emirates',
    shortAddress: 'Sharjah Media City (Shams), UAE',
    jurisdiction: 'United Arab Emirates',
    hours: 'Sunday — Thursday: 08:30 — 17:30 GST (UTC+4)',
    email: 'info@soltexglobal.co',
  },
};

/** Images of detail-page templates. */
export const TEMPLATE_MEDIA: Record<string, Record<string, string>> = {
  projectDetail: { archiveBandImage: '/images/tech_integrated_plant_1790271239031.jpg' },
  technologyDetail: { bandImage: '/images/tech_integrated_plant_1790271239031.jpg' },
};

/** Stable IDs of the home patent cards (previously keyed by short names). */
export const HOME_PATENT_IDS: Record<string, string> = {
  'apple-pectin': 'patent-bg-66235-b1',
  'citrus-pectin': 'patent-bg-63596-b1',
  'soy-protein': 'patent-bg-114363-a1',
  inulin: 'patent-bg-114364-a1',
};

/** Stable IDs of the /technologies/patents registry entries (index aligned with PATENTS_DATA). */
export const REGISTRY_PATENT_IDS = ['patent-113754', 'patent-ru-2709384-c1'];
