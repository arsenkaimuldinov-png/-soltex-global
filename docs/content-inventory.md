# Content inventory (Phase 1)

This document lists every piece of content the public site renders, where it lived before Phase 1, and where it lives now. It covers 29 routes × 6 languages. Content that was found in the code but is **not rendered** is listed separately: it was not modelled and not deleted.

**How content is stored**

- **Entities** are stored in `src/content/seed/*.json`.
- **Page texts** are fixed text slots of a page, stored in `src/content/seed/pages.json` → `copy`.
- **UI strings** are stored in `src/i18n/ui/<locale>.json`.

**Language**

- Every translatable content field holds all six languages (`{ en, ru, zh, tr, ar, es }`).
- Fields marked *structural* (IDs, slugs, numbers, codes, URLs, phone numbers, e-mail addresses) are not translated.
- All existing translations were migrated as `approved`. Each value is exactly what the legacy `t(English)` lookup returned.

**Owner**

- **Admin**: will be editable in the future custom admin. Today it is edited in the seed JSON.
- **Code**: developer-owned. This covers UI strings, layout, icons and route patterns.

## 1. Entities

| Entity (seed file) | Records | Rendered on (route → component) | Translatable fields | Structural fields | Owner | Source before Phase 1 |
|---|---|---|---|---|---|---|
| Project (`projects.json`) | 8 | `/projects` → ProjectsPage; `/projects/:slug` → ProjectDetailPage; related cards on TechnologyDetailPage and ProductDetailPage | title, category, country, years, capacity, type, overview, scope[], technology, results[], specs[].label/value | id, slug, order, categoryNumber, image, imagePosition, gallery[], relatedTechnologyId | Admin | `PROJECTS_DATA` (src/data/pagesData.ts) |
| Technology (`technologies.json`) | 6 | `/technologies` → TechnologiesPage; `/technologies/:slug` → TechnologyDetailPage; ProjectDetailPage and ProductDetailPage links | title, subtitle, categoryTitle, overview, patentInfo.patentNumber/location/keyPoints[], rawMaterials[], processPrinciples[].title/description, keyAdvantages[], applications[], productsProduced[] | id, slug, order, categoryNumber, image, relatedProjectIds[] | Admin | `TECHNOLOGIES_DATA` |
| Product (`products.json`) | 6 | `/products` → ProductsPage; `/products/:slug` → ProductDetailPage | title, categoryTitle, description, rawMaterials[], productionTechnology, applications[], characteristics[] | id, slug, order, categoryNumber, image, relatedTechnologyId, relatedProjectId | Admin | `PRODUCTS_DATA` |
| EPCM stage (`epcm-stages.json`) | 8 | `/` → EpcmStages (stepper and dialog); `/epcm` → EpcmPage and EpcmProcessRail | title, focus, description, deliverables[] | id, number, order, image | Admin | `EPCM_STAGES` (soltexData.ts) plus `EPCM_STAGE_IMAGES` (inline in EpcmPage) |
| Patent (`patents.json`) | 6 (4 home cards + 2 registry) | `/` → IntellectualProperty (placement `home`); `/technologies/patents` → PatentsPage (placement `registry`) | title, statusLabel, patentLabel, jurisdiction, abstract, claimsSummary[], code, location, overview, keyPillars[], industrialImplementation, imageCaption | id, placements, patentNo, legalStatus, registryNumber, image | Admin | Inline `PATENTS_DATA` in IntellectualProperty; `PATENTS_DATA` (pagesData.ts) plus inline `PATENT_IMAGERY` in PatentsPage |
| Video (`videos.json`) | 2 | `/` → VideoBlock (cards, hover preview, lightbox) | category, title, headline, description | id, number, order, video (`/videos/*.mp4`, unchanged), poster | Admin | `COMPANY_VIDEOS` |
| Media (`media.json`) | 24 | everywhere | alt (optional, unused today) | id, kind, src (unchanged paths under /public), width, height | Admin | Hard-coded paths |
| Global settings (`settings.json`) | 1 | Navbar (logo), Footer, MetricRibbon, ContactPage, GlobalPresencePage, CtaSection, SEO defaults | footerTagline, footerLocation, copyright, footerBackgroundAlt, headquarters.*, metrics[].label/highlight, offices[].region/title/country/address/representative, defaultSeo.* | siteName, primaryEmail, logos, metrics[].value, offices[].phone/email/whatsapp | Admin | Inline in Footer, MetricRibbon, ContactPage, GlobalPresencePage, CtaSection; `GLOBAL_OFFICES` |
| Redirect (`redirects.json`) | 0 | web server / build | — | from, to, statusCode, allLocales | Admin (SEO) | — (new) |

## 2. Pages and templates (`pages.json`)

`header.*` is rendered by `PageHeader`. `copy.*` holds a page's named text slots. `lists.*` holds its repeatable items. `media.*` holds its images.

### `home` — / (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| copy.allProjectsCta | ALL PROJECTS | VideoBlock | inline JSX `t()` |
| copy.allProjectsText | Discover more projects and engineering success stories. | VideoBlock | inline JSX `t()` |
| copy.allProjectsTitle | VIEW ALL ⏎ PROJECTS | VideoBlock | inline JSX `t()` |
| copy.epcmHeading | FROM CONCEPT ⏎ TO COMMERCIAL ⏎ PRODUCTION | EpcmStages | inline JSX `t()` |
| copy.epcmIntro | Full-cycle EPC / EPCM solutions for industrial plants. | EpcmStages | inline JSX `t()` |
| copy.epcmLink | OUR EPC / EPCM APPROACH | EpcmStages | inline JSX `t()` |
| copy.heroHeadlineLine1 | ENGINEERING | Hero | inline JSX `t()` |
| copy.heroHeadlineLine2 | ADVANCED PLANT | Hero | inline JSX `t()` |
| copy.heroHeadlineLine3 | PROCESSING FACILITIES | Hero | inline JSX `t()` |
| copy.heroImageAlt | Soltex Global Turnkey Industrial Processing Plant Facility | Hero | inline JSX `t()` |
| copy.heroSecondaryCta | EXPLORE TECHNOLOGIES | Hero | inline JSX `t()` |
| copy.ipHeading | TECHNOLOGY & ⏎ INTELLECTUAL PROPERTY | IntellectualProperty | inline JSX `t()` |
| copy.ipIntro | Our technologies are protected by patents and patent applications in … | IntellectualProperty | inline JSX `t()` |
| copy.ipLink | EXPLORE OUR IP PORTFOLIO | IntellectualProperty | inline JSX `t()` |
| copy.technologiesHeading | TECHNOLOGIES FOR HIGH-VALUE INGREDIENTS | KeyDirections | inline JSX `t()` |
| copy.videosHeading | VIDEO MATERIALS | VideoBlock | inline JSX `t()` |
| copy.heroEyebrow | INTERNATIONAL EPC / EPCM ENGINEERING GROUP | Hero | HERO_DATA (soltexData.ts) |
| copy.heroDescription | From feasibility studies and technology selection to engineering, equ… | Hero | HERO_DATA (soltexData.ts) |
| copy.heroUsp | Alcohol-free processing technologies with proven commercial operation | Hero | HERO_DATA (soltexData.ts) |
| lists.heroTags (4 items) | fields: label | Hero | HERO_DATA.metadataTags |
| lists.keyDirections (6 items) | fields: id, number, title, subtitle, description, image, href, rawMaterials, endProducts, technologyFeatures | KeyDirections | KEY_DIRECTIONS (soltexData.ts) |
| media.heroImage | `media-hero-soltex-panoramic-plant-1790270267701` | Hero | hard-coded image path |
| seo.metaTitle / metaDescription | Soltex Global — Turnkey Engineering for Advanced Plant Processing | prerender / SeoHead | `HOME_TITLE` / `HOME_DESCRIPTION` in src/i18n/seo.ts |

### `company` — /company (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | CORPORATE PROFILE | PageHeader (via AboutPage) | `<PageHeader>` props in AboutPage |
| header.title | Engineering Technological Sovereignty in Agro-Processing | PageHeader (via AboutPage) | `<PageHeader>` props in AboutPage |
| header.subtitle | 30+ Years of Patented Innovations & Industrial Turnkey Delivery | PageHeader (via AboutPage) | `<PageHeader>` props in AboutPage |
| header.description | Soltex Global is an international engineering and EPC enterprise spec… | PageHeader (via AboutPage) | `<PageHeader>` props in AboutPage |
| header.actionLabel | Request Consultation | PageHeader (via AboutPage) | `<PageHeader>` props in AboutPage |
| header.meta[0] | Founded Heritage: 30+ Years | PageHeader | `metaTags` prop |
| header.meta[1] | Core Specialization: Deep Plant Processing | PageHeader | `metaTags` prop |
| header.meta[2] | Global Registry: Sharjah, UAE | PageHeader | `metaTags` prop |
| header.meta[3] | Execution Scope: Full-Cycle EPCM | PageHeader | `metaTags` prop |
| copy.capabilitiesEyebrow | 02 · CORE CAPABILITIES | AboutPage | inline JSX `t()` |
| copy.capabilitiesHeading | Full-Cycle Technological Sovereignty | AboutPage | inline JSX `t()` |
| copy.capabilitiesIntro | We assume total responsibility across the biological, chemical, civil… | AboutPage | inline JSX `t()` |
| copy.ctaBadge | CORPORATE COLLABORATION | AboutPage | inline JSX `t()` |
| copy.ctaDescription | Schedule a technical consultation with Soltex Global chemical enginee… | AboutPage | inline JSX `t()` |
| copy.ctaTitle | Discuss Plant Development with Soltex Leadership | AboutPage | inline JSX `t()` |
| copy.epcmEyebrow | FULL-CYCLE EPCM SUPERVISION | AboutPage | inline JSX `t()` |
| copy.epcmImageAlt | Soltex Global Turnkey EPCM Construction Site | AboutPage | inline JSX `t()` |
| copy.epcmLink | Explore EPCM Process Stages | AboutPage | inline JSX `t()` |
| copy.epcmTitle | From Foundation Rigging to Commercial Hot Trials | AboutPage | inline JSX `t()` |
| copy.hygienicCompliance | COMPLIANCE: ISO 22000 · HACCP · GMP · HALAL | AboutPage | inline JSX `t()` |
| copy.hygienicEyebrow | STAINLESS HYGIENIC ENGINEERING | AboutPage | inline JSX `t()` |
| copy.hygienicImageAlt | Process Piping and Automated Control Network | AboutPage | inline JSX `t()` |
| copy.hygienicText | All process contact surfaces are constructed from food-grade AISI 316… | AboutPage | inline JSX `t()` |
| copy.hygienicTitle | Automated Cleanroom Standards & Continuous Flow | AboutPage | inline JSX `t()` |
| copy.mandateEyebrow | 01 · THE SOLTEX GLOBAL MANDATE | AboutPage | inline JSX `t()` |
| copy.mandateHeading | From Laboratory Biochemical Science to Multi-Thousand Ton Commercial … | AboutPage | inline JSX `t()` |
| copy.mandateParagraph1 | Soltex Global operates at the intersection of applied biochemical sci… | AboutPage | inline JSX `t()` |
| copy.mandateParagraph2 | Our primary focus centers on high-demand, mission-critical food and p… | AboutPage | inline JSX `t()` |
| copy.mandateProjectsLink | View Industrial Projects | AboutPage | inline JSX `t()` |
| copy.mandateTechnologiesLink | Explore Proprietary Technologies | AboutPage | inline JSX `t()` |
| copy.provenanceEyebrow | COMMERCIAL PROVENANCE · ASHDOD, ISRAEL | AboutPage | inline JSX `t()` |
| copy.provenanceImageAlt | Soltex Global Turnkey Industrial Processing Complex | AboutPage | inline JSX `t()` |
| copy.provenanceNote | Continuous Operational Run: 18+ Years | AboutPage | inline JSX `t()` |
| copy.provenanceTitle | Industrial Soy Protein Isolate Complex (17,000 t/year) | AboutPage | inline JSX `t()` |
| copy.purityLabel | Purity Target | AboutPage | inline JSX `t()` |
| copy.purityValue | > 90% Isolate | AboutPage | inline JSX `t()` |
| copy.recoveryLabel | Recovery Rate | AboutPage | inline JSX `t()` |
| copy.recoveryValue | Up to 92% | AboutPage | inline JSX `t()` |
| copy.timelineEyebrow | 03 · INDUSTRIAL CHRONOLOGY | AboutPage | inline JSX `t()` |
| copy.timelineHeading | Three Decades of Engineering Milestones | AboutPage | inline JSX `t()` |
| copy.timelineIntro | Verified chronicle of Soltex Global technological breakthroughs, comm… | AboutPage | inline JSX `t()` |
| copy.inquiryTopic | Corporate Consultation Request | AboutPage | PageHeader `primaryAction` topic |
| lists.capabilities (4 items) | fields: title, description | AboutPage | inline array in AboutPage |
| lists.timeline (8 items) | fields: year, title, description | AboutPage | COMPANY_TIMELINE (pagesData.ts) |
| media.provenanceImage | `media-hero-industrial-plant-1790267866540` | AboutPage | hard-coded image path |
| media.hygienicImage | `media-tech-integrated-plant-1790271239031` | AboutPage | hard-coded image path |
| media.epcmImage | `media-video-epcm-facility-1790267893198` | AboutPage | hard-coded image path |

### `globalPresence` — /company/global-presence (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | GEOGRAPHIC NETWORK | PageHeader (via GlobalPresencePage) | `<PageHeader>` props in GlobalPresencePage |
| header.title | Global Industrial Presence & Regional Hubs | PageHeader (via GlobalPresencePage) | `<PageHeader>` props in GlobalPresencePage |
| header.subtitle | Bridging International Engineering Precision with Local Agro-Industri… | PageHeader (via GlobalPresencePage) | `<PageHeader>` props in GlobalPresencePage |
| header.description | Soltex Global coordinates multi-national turnkey projects from our co… | PageHeader (via GlobalPresencePage) | `<PageHeader>` props in GlobalPresencePage |
| header.actionLabel | Contact Regional Director | PageHeader (via GlobalPresencePage) | `<PageHeader>` props in GlobalPresencePage |
| header.meta[0] | HQ Registry: Sharjah, UAE | PageHeader | `metaTags` prop |
| header.meta[1] | Primary Regions: Middle East, Asia, CIS | PageHeader | `metaTags` prop |
| header.meta[2] | Project Delivery: Multi-jurisdictional | PageHeader | `metaTags` prop |
| header.meta[3] | Language Coverage: English, Russian, Chinese, Hebrew | PageHeader | `metaTags` prop |
| copy.corridorsEyebrow | 01 · STRATEGIC GEOGRAPHIC CORRIDORS | GlobalPresencePage | inline JSX `t()` |
| copy.corridorsHeading | Seamless Cross-Border Project Execution | GlobalPresencePage | inline JSX `t()` |
| copy.corridorsParagraph1 | Large-scale industrial plants require rigorous international coordina… | GlobalPresencePage | inline JSX `t()` |
| copy.corridorsParagraph2 | Our distributed office network ensures that Soltex Global clients rec… | GlobalPresencePage | inline JSX `t()` |
| copy.ctaBadge | GLOBAL PROJECT DISCUSSIONS | GlobalPresencePage | inline JSX `t()` |
| copy.ctaDescription | Our global engineering directors travel regularly to review client si… | GlobalPresencePage | inline JSX `t()` |
| copy.ctaTitle | Schedule an On-Site or Direct Video Conference | GlobalPresencePage | inline JSX `t()` |
| copy.headquartersEyebrow | HEADQUARTERS & EPC COORDINATION | GlobalPresencePage | inline JSX `t()` |
| copy.headquartersText | Our central corporate base governs overall contract administration, i… | GlobalPresencePage | inline JSX `t()` |
| copy.site1Region | MIDDLE EAST | GlobalPresencePage | inline JSX `t()` |
| copy.site1Text | 17,000 t/year soy protein isolate manufacturing facility. Continuousl… | GlobalPresencePage | inline JSX `t()` |
| copy.site1Title | Ashdod, Israel | GlobalPresencePage | inline JSX `t()` |
| copy.site2Region | EAST ASIA | GlobalPresencePage | inline JSX `t()` |
| copy.site2Text | 10,000 t/year turnkey deep soy processing complex. High-purity isolat… | GlobalPresencePage | inline JSX `t()` |
| copy.site2Title | Ningbo, China | GlobalPresencePage | inline JSX `t()` |
| copy.site3Region | CENTRAL ASIA | GlobalPresencePage | inline JSX `t()` |
| copy.site3Text | 1,000 t/year apple pectin industrial manufacturing plant. Turnkey EPC… | GlobalPresencePage | inline JSX `t()` |
| copy.site3Title | Namangan, Uzbekistan | GlobalPresencePage | inline JSX `t()` |
| copy.site4Region | EURASIA & CIS | GlobalPresencePage | inline JSX `t()` |
| copy.site4Text | Biostim, S-Protein, and Jerusalem artichoke inulin fractionation line… | GlobalPresencePage | inline JSX `t()` |
| copy.site4Title | Multiple Industrial Sites | GlobalPresencePage | inline JSX `t()` |
| copy.sitesEyebrow | 02 · INTERNATIONAL REFERENCE SITES | GlobalPresencePage | inline JSX `t()` |
| copy.sitesHeading | Operational Facilities by Region | GlobalPresencePage | inline JSX `t()` |
| copy.inquiryTopic | Regional Office Inquiry | GlobalPresencePage | PageHeader `primaryAction` topic |

### `technologies` — /technologies (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | PROPRIETARY IP | PageHeader (via TechnologiesPage) | `<PageHeader>` props in TechnologiesPage |
| header.title | Patented Agro-Processing Technologies | PageHeader (via TechnologiesPage) | `<PageHeader>` props in TechnologiesPage |
| header.subtitle | Transforming Agricultural Feedstock into High-Margin Functional Ingre… | PageHeader (via TechnologiesPage) | `<PageHeader>` props in TechnologiesPage |
| header.description | Soltex Global develops, patents, and licenses comprehensive industria… | PageHeader (via TechnologiesPage) | `<PageHeader>` props in TechnologiesPage |
| header.actionLabel | Request Technology Dossier | PageHeader (via TechnologiesPage) | `<PageHeader>` props in TechnologiesPage |
| header.meta[0] | Core Intellectual Property: International Patents | PageHeader | `metaTags` prop |
| header.meta[1] | Extraction Efficiency: Up to 92% Recovery | PageHeader | `metaTags` prop |
| header.meta[2] | Environmental Standard: Zero-Waste Circular | PageHeader | `metaTags` prop |
| header.meta[3] | Scalability: Industrial Multi-Ton | PageHeader | `metaTags` prop |
| copy.ctaBadge | TECHNOLOGY LICENSING & TESTING | TechnologiesPage | inline JSX `t()` |
| copy.ctaDescription | Submit laboratory samples of your raw plant biomass for comprehensive… | TechnologiesPage | inline JSX `t()` |
| copy.ctaTitle | Validate Your Feedstock in Our Testing Facilities | TechnologiesPage | inline JSX `t()` |
| copy.patentRegistryLink | Review Patent Registry → | TechnologiesPage | inline JSX `t()` |
| copy.inquiryTopic | Technology Licensing & Process Inquiry | TechnologiesPage | PageHeader `primaryAction` topic |

### `patents` — /technologies/patents (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | INTELLECTUAL PROPERTY | PageHeader (via PatentsPage) | `<PageHeader>` props in PatentsPage |
| header.title | Patents, Scientific IP & Licensing | PageHeader (via PatentsPage) | `<PageHeader>` props in PatentsPage |
| header.subtitle | Proprietary Biochemical Inventions Grounded in Commercial Industrial … | PageHeader (via PatentsPage) | `<PageHeader>` props in PatentsPage |
| header.description | Soltex Global safeguards its clients' market exclusivity through regi… | PageHeader (via PatentsPage) | `<PageHeader>` props in PatentsPage |
| header.actionLabel | Request Licensing Dossier | PageHeader (via PatentsPage) | `<PageHeader>` props in PatentsPage |
| header.meta[0] | Portfolio Status: Active Registered IP | PageHeader | `metaTags` prop |
| header.meta[1] | Key Jurisdictions: EPO, Israel, Bulgaria, CIS | PageHeader | `metaTags` prop |
| header.meta[2] | Licensing Model: Exclusive with Turnkey EPC | PageHeader | `metaTags` prop |
| header.meta[3] | Industrial Proof: Validated in Commercial Plants | PageHeader | `metaTags` prop |
| copy.assurance1Text | All technology licensing dialogues are governed by standard industria… | PatentsPage | inline JSX `t()` |
| copy.assurance1Title | Confidentiality Guarantee | PatentsPage | inline JSX `t()` |
| copy.assurance2Text | Turnkey EPC clients may secure defined geographic exclusivity for spe… | PatentsPage | inline JSX `t()` |
| copy.assurance2Title | Exclusive Territory Protection | PatentsPage | inline JSX `t()` |
| copy.assurance3Text | Soltex Global continually refines separation economics, updating lice… | PatentsPage | inline JSX `t()` |
| copy.assurance3Title | Continuous Process R&D | PatentsPage | inline JSX `t()` |
| copy.ctaBadge | PATENT LICENSING & IP PORTFOLIO | PatentsPage | inline JSX `t()` |
| copy.ctaDescription | Our legal and technological licensing team provides full documentatio… | PatentsPage | inline JSX `t()` |
| copy.ctaTitle | Acquire Exclusive Rights to Patented Extraction Technologies | PatentsPage | inline JSX `t()` |
| copy.registryEyebrow | REGISTERED SCIENTIFIC MONOGRAPHS | PatentsPage | inline JSX `t()` |
| copy.registryHeading | Commercial Patent Portfolio & Reference Assets | PatentsPage | inline JSX `t()` |
| copy.statusValue | Active & Industrially Scaled | PatentsPage | inline JSX `t()` |
| copy.inquiryTopic | Patent Licensing & IP Dossier Request | PatentsPage | PageHeader `primaryAction` topic |

### `epcm` — /epcm (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | TURNKEY DELIVERY | PageHeader (via EpcmPage) | `<PageHeader>` props in EpcmPage |
| header.title | Full-Cycle EPCM Industrial Services | PageHeader (via EpcmPage) | `<PageHeader>` props in EpcmPage |
| header.subtitle | From Laboratory Concept to Continuous Multi-Ton Commercial Production | PageHeader (via EpcmPage) | `<PageHeader>` props in EpcmPage |
| header.description | Soltex Global delivers complex deep agro-processing installations und… | PageHeader (via EpcmPage) | `<PageHeader>` props in EpcmPage |
| header.actionLabel | Inquire for Plant Delivery | PageHeader (via EpcmPage) | `<PageHeader>` props in EpcmPage |
| header.meta[0] | Contract Models: Turnkey EPC / EPCM / PMC | PageHeader | `metaTags` prop |
| header.meta[1] | Quality Standards: ISO 9001 · HACCP · GMP | PageHeader | `metaTags` prop |
| header.meta[2] | Operational Guarantee: Output Purity & Volume | PageHeader | `metaTags` prop |
| header.meta[3] | Lifecycle Responsibility: End-to-End Delivery | PageHeader | `metaTags` prop |
| copy.ctaBadge | PROJECT EXECUTION MANDATE | EpcmPage | inline JSX `t()` |
| copy.ctaDescription | Connect with our lead process engineers and construction directors to… | EpcmPage | inline JSX `t()` |
| copy.ctaTitle | Schedule an Engineering Scoping Workshop | EpcmPage | inline JSX `t()` |
| copy.guaranteeEyebrow | GUARANTEED DELIVERABLES | EpcmPage | inline JSX `t()` |
| copy.guaranteeItem1 | Guaranteed annual metric ton throughput | EpcmPage | inline JSX `t()` |
| copy.guaranteeItem2 | Verified chemical purity (e.g. 90%+ soy isolate protein) | EpcmPage | inline JSX `t()` |
| copy.guaranteeItem3 | Fixed utility consumption ceilings per ton of finished product | EpcmPage | inline JSX `t()` |
| copy.guaranteeItem4 | Certified local operating staff upon commercial commissioning | EpcmPage | inline JSX `t()` |
| copy.guaranteeTitle | Our Performance Guarantee | EpcmPage | inline JSX `t()` |
| copy.philosophyEyebrow | 01 · THE EPCM PHILOSOPHY | EpcmPage | inline JSX `t()` |
| copy.philosophyHeading | Single-Point Responsibility Eliminates Technology Risk | EpcmPage | inline JSX `t()` |
| copy.philosophyParagraph1 | Industrial processing facilities frequently suffer from the disconnec… | EpcmPage | inline JSX `t()` |
| copy.philosophyParagraph2 | Our multidisciplinary engineering core oversees every calculation: fr… | EpcmPage | inline JSX `t()` |
| copy.workflowEyebrow | 02 · FULL-CYCLE WORKFLOW | EpcmPage | inline JSX `t()` |
| copy.workflowHeading | Systematic Industrial Execution Architecture | EpcmPage | inline JSX `t()` |
| copy.workflowIntro | Eight structured stages that guarantee bankable feasibility, complian… | EpcmPage | inline JSX `t()` |
| copy.inquiryTopic | Turnkey EPCM Project Inquiry | EpcmPage | PageHeader `primaryAction` topic |

### `products` — /products (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | COMMERCIAL OUTPUTS | PageHeader (via ProductsPage) | `<PageHeader>` props in ProductsPage |
| header.title | High-Value Plant Ingredients & Biochemical Outputs | PageHeader (via ProductsPage) | `<PageHeader>` props in ProductsPage |
| header.subtitle | Manufactured Exclusively via Soltex Global Patented Extraction Facili… | PageHeader (via ProductsPage) | `<PageHeader>` props in ProductsPage |
| header.description | The tangible output of our engineering prowess. Soltex Global facilit… | PageHeader (via ProductsPage) | `<PageHeader>` props in ProductsPage |
| header.actionLabel | Request Product Specs | PageHeader (via ProductsPage) | `<PageHeader>` props in ProductsPage |
| header.meta[0] | Grade Standards: Food, Pharma, Dietary | PageHeader | `metaTags` prop |
| header.meta[1] | Purity Benchmarks: Up to 92% Active Compound | PageHeader | `metaTags` prop |
| header.meta[2] | Feedstock Base: Non-GMO Natural Biomass | PageHeader | `metaTags` prop |
| header.meta[3] | Regulatory Compliance: ISO 22000 · Halal · Kosher | PageHeader | `metaTags` prop |
| copy.ctaBadge | INGREDIENT SOURCING & PLANT CAPACITY | ProductsPage | inline JSX `t()` |
| copy.ctaDescription | Whether you wish to license our processing facility blueprints to est… | ProductsPage | inline JSX `t()` |
| copy.ctaTitle | Looking to Produce or Source These High-Value Ingredients? | ProductsPage | inline JSX `t()` |
| copy.listNote | STANDARDIZED TO GLOBAL FOOD & PHARMA CODES | ProductsPage | inline JSX `t()` |
| copy.inquiryTopic | Commercial Ingredient Specifications Request | ProductsPage | PageHeader `primaryAction` topic |

### `projects` — /projects (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | INDUSTRIAL TRACK RECORD | PageHeader (via ProjectsPage) | `<PageHeader>` props in ProjectsPage |
| header.title | Industrial Projects & Turnkey Facilities | PageHeader (via ProjectsPage) | `<PageHeader>` props in ProjectsPage |
| header.subtitle | 30+ Years of International EPC Project Delivery | PageHeader (via ProjectsPage) | `<PageHeader>` props in ProjectsPage |
| header.description | Factual overview of completed and operational industrial plants deliv… | PageHeader (via ProjectsPage) | `<PageHeader>` props in ProjectsPage |
| header.actionLabel | Submit Plant Inquiry | PageHeader (via ProjectsPage) | `<PageHeader>` props in ProjectsPage |
| header.meta[0] | Total Track Record: 30+ Years | PageHeader | `metaTags` prop |
| header.meta[1] | Delivery Model: Turnkey EPC / EPCM | PageHeader | `metaTags` prop |
| header.meta[2] | Verified Geography: Asia, Middle East, CIS | PageHeader | `metaTags` prop |
| header.meta[3] | Flagship Scale: 17,000 t/y Isolate | PageHeader | `metaTags` prop |
| copy.ctaBadge | PROJECT FEASIBILITY & CONSULTATION | ProjectsPage | inline JSX `t()` |
| copy.ctaDescription | Share your feedstock parameters, target annual capacity, and preferre… | ProjectsPage | inline JSX `t()` |
| copy.ctaTitle | Planning a Plant Construction or Modernization? | ProjectsPage | inline JSX `t()` |
| copy.listNote | SORTED BY HISTORICAL CHRONOLOGY & SCALE | ProjectsPage | inline JSX `t()` |
| copy.stat1Label | Largest Soy Isolate Line | ProjectsPage | inline JSX `t()` |
| copy.stat1Note | Constructed in Ashdod, Israel | ProjectsPage | inline JSX `t()` |
| copy.stat1Value | 17,000 t/y | ProjectsPage | inline JSX `t()` |
| copy.stat2Label | Pectin Capacity Delivered | ProjectsPage | inline JSX `t()` |
| copy.stat2Note | Apple pectin plant in Namangan | ProjectsPage | inline JSX `t()` |
| copy.stat2Value | 1,000 t/y | ProjectsPage | inline JSX `t()` |
| copy.stat3Label | Continuous Plant Operation | ProjectsPage | inline JSX `t()` |
| copy.stat3Note | Proof of enduring engineering durability | ProjectsPage | inline JSX `t()` |
| copy.stat3Value | 18+ Years | ProjectsPage | inline JSX `t()` |
| copy.stat4Label | From Lab to Commercial Run | ProjectsPage | inline JSX `t()` |
| copy.stat4Note | Guaranteed product output specifications | ProjectsPage | inline JSX `t()` |
| copy.stat4Value | 100% Turnkey | ProjectsPage | inline JSX `t()` |
| copy.inquiryTopic | New Turnkey Project Inquiry | ProjectsPage | PageHeader `primaryAction` topic |

### `contact` — /contact (page, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | COMMUNICATIONS DESK | PageHeader (via ContactPage) | `<PageHeader>` props in ContactPage |
| header.title | Engineering Inquiries & Global Representation | PageHeader (via ContactPage) | `<PageHeader>` props in ContactPage |
| header.subtitle | Direct Collaboration with Soltex Global Project Directors | PageHeader (via ContactPage) | `<PageHeader>` props in ContactPage |
| header.description | Connect with our central engineering bureau in the UAE or our regiona… | PageHeader (via ContactPage) | `<PageHeader>` props in ContactPage |
| header.meta[0] | Central Registry: Sharjah Media City, UAE | PageHeader | `metaTags` prop |
| header.meta[1] | Response Protocol: Within 24 Working Hours | PageHeader | `metaTags` prop |
| header.meta[2] | Direct Desk: info@soltexglobal.co | PageHeader | `metaTags` prop |
| header.meta[3] | Technical NDA: Standard Industrial Terms | PageHeader | `metaTags` prop |
| copy.headquartersEyebrow | PRIMARY HEADQUARTERS & EPC REGISTRY | ContactPage | inline JSX `t()` |
| copy.ipText | Soltex Global operates strictly under signed two-way NDAs prior to di… | ContactPage | inline JSX `t()` |
| copy.ipTitle | Industrial Intellectual Property Protection | ContactPage | inline JSX `t()` |
| copy.officesEyebrow | REGIONAL LIAISON OFFICES & REPRESENTATIVES | ContactPage | inline JSX `t()` |

### `privacy` — /privacy (draft) (page, draft)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | Privacy Policy | PageHeader (via LegalPage) | `<PageHeader>` props in — |
| header.title | Privacy Policy | PageHeader (via LegalPage) | `<PageHeader>` props in — |

### `terms` — /terms (draft) (page, draft)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| header.badgeLabel | Terms of Use | PageHeader (via LegalPage) | `<PageHeader>` props in — |
| header.title | Terms of Use | PageHeader (via LegalPage) | `<PageHeader>` props in — |

### `projectDetail` — /projects/:slug (template, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| copy.archiveEyebrow | ARCHIVAL ENGINEERING RECORD | ProjectDetailPage | inline JSX `t()` |
| copy.archiveImageAlt | Hygienic Separation Equipment Hall | ProjectDetailPage | inline JSX `t()` |
| copy.archiveTitle | Precision Separation & Multi-Stage Evaporation Infrastructure | ProjectDetailPage | inline JSX `t()` |
| copy.badgeLabel | {category} · CASE STUDY | ProjectDetailPage | inline JSX `t()` |
| copy.capacityFallback | Custom Industrial | ProjectDetailPage | inline literal |
| copy.certificationText | Verified commercial implementation of Soltex process platform | ProjectDetailPage | inline JSX `t()` |
| copy.certificationTitle | PATENT & IP CERTIFICATION | ProjectDetailPage | inline JSX `t()` |
| copy.contextEyebrow | 01 · INDUSTRIAL IMPLEMENTATION CONTEXT | ProjectDetailPage | inline JSX `t()` |
| copy.contextHeading | Commercial Mandate & Engineering Background | ProjectDetailPage | inline JSX `t()` |
| copy.contextParagraph | Constructed in strict accordance with Soltex Global’s proprietary pro… | ProjectDetailPage | inline JSX `t()` |
| copy.contractScopeValue | Turnkey EPC / EPCM | ProjectDetailPage | inline literal |
| copy.ctaBadge | ENGINEERING FEASIBILITY | ProjectDetailPage | inline JSX `t()` |
| copy.ctaDescription | Our multi-disciplinary chemical engineering team provides full cycle … | ProjectDetailPage | inline JSX `t()` |
| copy.ctaTitle | Inquire About Engineering a Plant Like {title} | ProjectDetailPage | inline JSX `t()` |
| copy.galleryEyebrow | 05 · FACILITY ARCHIVE IMAGERY | ProjectDetailPage | inline JSX `t()` |
| copy.galleryHeading | Site Photographic Documentation | ProjectDetailPage | inline JSX `t()` |
| copy.headerActionLabel | Request Similar Facility Audit | ProjectDetailPage | inline literal |
| copy.headerInquiryTopic | Inquiry for project model: {title} | ProjectDetailPage | inline JSX `t()` |
| copy.resultsEyebrow | 04 · PERFORMANCE GUARANTEES | ProjectDetailPage | inline JSX `t()` |
| copy.resultsHeading | Commercial Output & Performance Validation | ProjectDetailPage | inline JSX `t()` |
| copy.scopeEyebrow | 03 · TURNKEY EPCM RESPONSIBILITY | ProjectDetailPage | inline JSX `t()` |
| copy.scopeHeading | Scope of Delivery & Work Completed | ProjectDetailPage | inline JSX `t()` |
| copy.technologyEyebrow | 02 · INTEGRATED PROCESS TECHNOLOGY | ProjectDetailPage | inline JSX `t()` |
| copy.technologyHeading | Applied Process: {technology} | ProjectDetailPage | inline JSX `t()` |
| copy.technologyParagraph | This installation operates under proprietary separation thermodynamic… | ProjectDetailPage | inline JSX `t()` |
| media.archiveBandImage | `media-tech-integrated-plant-1790271239031` | ProjectDetailPage | hard-coded image path |

### `technologyDetail` — /technologies/:slug (template, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| copy.advantagesEyebrow | 02 · COMPARATIVE METRICS & ADVANTAGES | TechnologyDetailPage | inline JSX `t()` |
| copy.advantagesHeading | Engineering Advantages | TechnologyDetailPage | inline JSX `t()` |
| copy.applicationsEyebrow | 03 · COMMERCIAL VALUE & TARGET INDUSTRIES | TechnologyDetailPage | inline JSX `t()` |
| copy.applicationsHeading | Output Utilization Sectors | TechnologyDetailPage | inline JSX `t()` |
| copy.badgeLabel | {category} · PROCESS SPECIFICATION | TechnologyDetailPage | inline JSX `t()` |
| copy.bandCaption | AISI 316L Food-Grade Process Metallurgy | TechnologyDetailPage | inline JSX `t()` |
| copy.bandImageAlt | Proprietary Separation Reactors and Vacuum Evaporators | TechnologyDetailPage | inline JSX `t()` |
| copy.bandTag | Patented Separation | TechnologyDetailPage | inline JSX `t()` |
| copy.ctaBadge | FEEDSTOCK ASSAY & FEASIBILITY | TechnologyDetailPage | inline JSX `t()` |
| copy.ctaDescription | Soltex Global provides complete technology transfer packages, P&ID pr… | TechnologyDetailPage | inline JSX `t()` |
| copy.ctaTitle | Inquire About Licensing or Engineering {title} | TechnologyDetailPage | inline JSX `t()` |
| copy.efficiencyValue | High Yield Recovery | TechnologyDetailPage | inline literal |
| copy.facilitiesEyebrow | 04 · INDUSTRIAL REFERENCE FACILITIES | TechnologyDetailPage | inline JSX `t()` |
| copy.facilitiesHeading | Commercial Facilities Operating this Platform | TechnologyDetailPage | inline JSX `t()` |
| copy.feedstockFallback | Plant Biomass | TechnologyDetailPage | inline literal |
| copy.headerActionLabel | Request Process Flowsheet | TechnologyDetailPage | inline literal |
| copy.headerInquiryTopic | Process Flowsheet Request: {title} | TechnologyDetailPage | inline JSX `t()` |
| copy.heroEyebrow | BIOPROCESS EXTRACTION CORE | TechnologyDetailPage | inline JSX `t()` |
| copy.patentFallback | Proprietary Trade Secret | TechnologyDetailPage | inline literal |
| copy.principlesEyebrow | 01 · THERMODYNAMIC & CHEMICAL FLOW | TechnologyDetailPage | inline JSX `t()` |
| copy.principlesHeading | Core Process Flowsheet Principles | TechnologyDetailPage | inline JSX `t()` |
| copy.statusValue | Commercially Operational | TechnologyDetailPage | inline literal |
| media.bandImage | `media-tech-integrated-plant-1790271239031` | TechnologyDetailPage | hard-coded image path |

### `productDetail` — /products/:slug (template, published)

| Field | English text (abridged) | Component | Source before Phase 1 |
|---|---|---|---|
| copy.applicationsEyebrow | 02 · SECTOR FORMULATIONS | ProductDetailPage | inline JSX `t()` |
| copy.applicationsHeading | Target Formulations & Commercial Uses | ProductDetailPage | inline JSX `t()` |
| copy.badgeLabel | {category} · SPECIFICATION | ProductDetailPage | inline JSX `t()` |
| copy.characteristicsEyebrow | 01 · PHYSICAL & CHEMICAL CHARACTERISTICS | ProductDetailPage | inline JSX `t()` |
| copy.characteristicsHeading | Verified Chemical & Physical Profile | ProductDetailPage | inline JSX `t()` |
| copy.complianceValue | ISO 22000 / HACCP / GMP | ProductDetailPage | inline literal |
| copy.ctaBadge | COMMERCIAL BULK CONTRACTS | ProductDetailPage | inline JSX `t()` |
| copy.ctaDescription | Whether engineering your own localized plant or purchasing bulk certi… | ProductDetailPage | inline JSX `t()` |
| copy.ctaTitle | Discuss Manufacturing or Supply of {title} | ProductDetailPage | inline JSX `t()` |
| copy.feedstockFallback | Natural Agro-Biomass | ProductDetailPage | inline literal |
| copy.headerActionLabel | Request Certificate of Analysis (COA) | ProductDetailPage | inline literal |
| copy.headerInquiryTopic | COA & Spec Sheet Request for {title} | ProductDetailPage | inline JSX `t()` |
| copy.imageTag | Industrial Standard | ProductDetailPage | inline JSX `t()` |
| copy.packagingValue | 25 kg multi-wall craft bags / Big Bags (1,000 kg) | ProductDetailPage | inline JSX `t()` |
| copy.provenanceEyebrow | 03 · INDUSTRIAL PROVENANCE & PLANT REFERENCE | ProductDetailPage | inline JSX `t()` |
| copy.purityFallback | International Benchmark | ProductDetailPage | inline literal |
| copy.regulatoryValue | FCC, USP, EP, ISO 22000, Halal, Kosher | ProductDetailPage | inline JSX `t()` |
| copy.shelfLifeValue | 24 Months from production date | ProductDetailPage | inline JSX `t()` |
| copy.subtitle | Standardized Industrial Food & Pharma Grade Output | ProductDetailPage | inline JSX `t()` |
## 3. Global settings detail

| Field | Rendered by | Before Phase 1 |
|---|---|---|
| logo, logoReversed | Navbar, Footer | hard-coded `/images/soltex-global-logo-*.png` |
| footerTagline, footerLocation, copyright | Footer | inline `t()` literals |
| footerBackground, footerBackgroundAlt | Footer | inline literals |
| primaryEmail | Footer, CtaSection | inline `info@soltexglobal.co` |
| headquarters.name/addressLine1/addressLine2/hours/email | ContactPage | inline literals |
| headquarters.shortAddress/jurisdiction/email | GlobalPresencePage | inline literals |
| metrics[5] (value, label, highlight) | MetricRibbon | inline JSX (values and labels) |
| offices[4] | ContactPage, GlobalPresencePage | `GLOBAL_OFFICES` |
| defaultSeo.siteTitle/siteDescription | 404 page description; future fallbacks | `HOME_TITLE` / `HOME_DESCRIPTION` |

## 4. UI strings (`src/i18n/ui/*.json`, code-owned, 209 keys)

These cover navigation, breadcrumbs, buttons, form labels and placeholders, dialog controls, accessibility labels, counters, system messages, field labels of detail-page specification blocks, and the not-found page. The English file defines the TypeScript key type, so `t()` rejects unknown keys at compile time. The content build fails if any language is missing a key or has different `{placeholders}`.

| Key group | Keys | Used in |
|---|---|---|
| `breadcrumb.*` | 9 | PageHeader breadcrumbs |
| `common.*` | 8 | CtaSection, EpcmStages, Footer, Hero, IntellectualProperty, KeyDirections, Navbar, ProductDetailPage, ProjectDetailPage, ProjectInquiryModal, TechnologyDetailPage |
| `contactForm.*` | 18 | ContactPage |
| `ctaForm.*` | 7 | CtaSection |
| `epcm.*` | 8 | EpcmPage, EpcmStages |
| `footer.*` | 27 | Footer |
| `globalPresence.*` | 2 | GlobalPresencePage |
| `header.*` | 2 | Navbar |
| `inquiry.*` | 12 | ProjectInquiryModal |
| `keyDirections.*` | 9 | KeyDirections |
| `leadForm.*` | 5 | ContactPage, CtaSection, ProjectInquiryModal |
| `nav.*` | 7 | Navbar, PageHeader |
| `office.*` | 6 | GlobalPresencePage |
| `patent.*` | 6 | IntellectualProperty |
| `patents.*` | 8 | PatentsPage |
| `productDetail.*` | 22 | ProductDetailPage |
| `products.*` | 5 | ProductsPage |
| `projectDetail.*` | 15 | ProjectDetailPage |
| `projects.*` | 4 | ProjectsPage |
| `technologies.*` | 5 | TechnologiesPage |
| `technologyDetail.*` | 17 | TechnologyDetailPage |
| `video.*` | 3 | VideoBlock || `notFound.*` | 4 | NotFoundPage. New in Phase 1; the RU/ZH/TR/AR/ES texts were written in Phase 1 and **require client linguistic review** (content-review item, not an architecture blocker) |

## 5. Not rendered: intentionally NOT modelled (kept in place, not deleted)

| Item | Where | Reason |
|---|---|---|
| Components AboutModal, ContactModal, FeaturedProject, FinalCta, IndustriesModal, InsightsModal, MissionDark, SectorsGrid, VideoModal, WhySoltex | `src/components/` | Not rendered anywhere. VideoModal and ContactModal were mounted but could never open. They are excluded from type checking (`tsconfig.json` → `exclude`) only because they are legacy, and are kept until the dedicated cleanup task |
| `HERO_DATA.headline`, `HERO_DATA.primaryCta`, `HERO_DATA.secondaryCta`, `HERO_DATA.heroImage` duplicates | `src/data/soltexData.ts` | The hero renders its own headline lines (`copy.heroHeadlineLine1-3`) and CTA labels |
| `METRIC_RIBBON` | soltexData.ts | Not rendered; the ribbon used inline values (now `settings.metrics`). Note it says "300M+ USD" where the rendered ribbon says "300+ MILLION USD" |
| `VIDEO_MATERIALS`, `SECTORS_OF_APPLICATION`, `WHY_SOLTEX_ITEMS`, `MISSION_COLUMNS`, `FEATURED_PROJECT`, `FINAL_CTA_DATA` | soltexData.ts | Used only by the unused components |
| `PUBLIC_SCALE_EXPERIENCE` | pagesData.ts | Not rendered |
| `CtaSection` default badge/title/description/topic and every page's `topic` prop | CtaSection, pages | Defaults were never used, and `topic` was never read by the component (removed from props) |
| Legacy dictionaries `src/i18n/locales/*.json` | — | Migration source only, no longer loaded. 191 entries per language belonged to unrendered content (old 10-stage EPCM texts, unused components, unused topics). See `scripts/content/migration/migration-report.json` |
| `src/data/*.ts`, `src/types/index.ts` | — | Migration source only, no longer imported by the site. Kept until the dedicated cleanup task |
| `src/i18n/dictionaries.ts` | — | Old dictionary loader, replaced by `src/i18n/bundles.ts`. Kept and excluded from type checking (legacy) |

## 6. Conflicts and observations (content unchanged, for client verification)

1. **Patents.** The home IP section shows four Bulgarian patents and applications (BG 66235 B1, BG 63596 B1, BG 114363 A1, BG 114364 A1). `/technologies/patents` shows two different records (Patent Application No. 113754; RU 2709384 C1), and the technology pages cite 113754. They are kept as six separate Patent records distinguished by `placements`; none were merged.
2. **Company age.** The page header says "30+ Years", the metric ribbon "25+", and the timeline starts in 1999. This is unchanged; see `docs/copy-audit.md`.
3. **Office hours.** Contact shows "Sunday — Thursday: 08:30 — 17:30 GST (UTC+4)". The unused ContactModal says "Mon – Fri". Only the rendered value was modelled.
4. **Untranslated values.** `info@soltexglobal.co` and the placeholder `project.desk@company.com` have no dictionary entry. They display identically in every language, as before.
5. All `VERIFY` items of `docs/copy-audit.md` are unchanged.
