export interface ProjectItem {
  slug: string;
  category: string;
  categoryNumber: string;
  title: string;
  country: string;
  years: string;
  capacity?: string;
  type: string;
  overview: string;
  scope: string[];
  technology: string;
  results?: string[];
  image: string;
  /** Optional CSS object-position for the cover crop (e.g. keep a slide title visible). */
  imagePosition?: string;
  gallery?: string[];
  relatedTechSlug: string;
  specs: { label: string; value: string }[];
}

export interface TechnologyItem {
  slug: string;
  categoryNumber: string;
  categoryTitle: string;
  title: string;
  subtitle: string;
  overview: string;
  patentInfo?: {
    patentNumber: string;
    location: string;
    keyPoints: string[];
  };
  rawMaterials: string[];
  processPrinciples: { title: string; description: string }[];
  keyAdvantages: string[];
  applications: string[];
  productsProduced: string[];
  relatedProjects: string[];
  image: string;
}

export interface ProductItem {
  slug: string;
  categoryNumber: string;
  categoryTitle: string;
  title: string;
  description: string;
  rawMaterials: string[];
  productionTechnology: string;
  applications: string[];
  characteristics: string[];
  relatedTechSlug: string;
  relatedProjectSlug: string;
  image: string;
}

export interface OfficeLocation {
  region: string;
  title: string;
  country: string;
  address?: string;
  representative?: string;
  phone?: string;
  email: string;
  whatsapp?: string;
}

// ==========================================
// 1. PROJECTS FACTUAL DATA (from screenshots)
// ==========================================
export const PROJECTS_DATA: ProjectItem[] = [
  {
    slug: 'solbar-israel',
    category: 'DEEP SOY PROCESSING',
    categoryNumber: '01',
    title: 'SOLBAR ISRAEL',
    country: 'Israel',
    years: '2002–2004',
    capacity: '17,000 t/year',
    type: 'Soy Protein Isolate Industrial Plant',
    overview: 'Construction of an industrial manufacturing complex with a capacity of 17,000 t/y of soy protein isolate. Patent obtained for a unique aqueous extraction technology.',
    scope: [
      'Comprehensive basic and detailed process engineering',
      'Proprietary aqueous protein isolation equipment supply',
      'Construction supervision, civil assembly and cleanroom pipework',
      'Integration of automated PLC/SCADA control architectures',
      'Staff certification and sustained operation for 18+ years'
    ],
    technology: 'Aqueous Extraction & Isoelectric Precipitation (Patented)',
    results: [
      '17,000 metric tons annual production capacity',
      'World-class protein purity exceeding 90% isolate standard',
      'Continuous uninterrupted commercial operation for over 18 years'
    ],
    image: '/images/projects/solbar-israel.jpg',
    gallery: [
      '/images/projects/solbar-israel.jpg'
    ],
    relatedTechSlug: 'soy-protein',
    specs: [
      { label: 'Location', value: 'Ashdod / Southern District, Israel' },
      { label: 'Project Period', value: '2002–2004' },
      { label: 'Installed Capacity', value: '17,000 t/y Isolate' },
      { label: 'Delivery Model', value: 'Full-Cycle EPC Engineering' }
    ]
  },
  {
    slug: 'solbar-ningbo',
    category: 'DEEP SOY PROCESSING',
    categoryNumber: '01',
    title: 'SOLBAR NINGBO',
    country: 'China',
    years: '2006–2008',
    capacity: '10,000 t/year',
    type: 'Turnkey Soy Processing Complex',
    overview: 'Turnkey project with a capacity of 10,000 t/y of isolate from "white flake". Established the global industrial standard of product purity and efficiency in Asia.',
    scope: [
      'Site master planning and industrial civil design',
      'Turnkey equipment supply and international logistics management',
      'Assembly of multi-stage extraction, separation and spray drying lines',
      'Commissioning, cold and live product testing runs',
      'Operational launch and operator certification'
    ],
    technology: 'Deep Soy Processing from White Flake Feedstock',
    results: [
      '10,000 t/y soy isolate capacity reached ahead of schedule',
      'Ultra-low chemical footprint with closed-loop water recovery',
      'Certified under global ISO 9001 and HACCP quality protocols'
    ],
    image: '/images/projects/solbar-ningbo.jpg',
    imagePosition: 'center top',
    gallery: [
      '/images/projects/solbar-ningbo.jpg'
    ],
    relatedTechSlug: 'soy-protein',
    specs: [
      { label: 'Location', value: 'Ningbo, Zhejiang Province, China' },
      { label: 'Project Period', value: '2006–2008' },
      { label: 'Feedstock Base', value: 'Non-GMO Defatted White Flake' },
      { label: 'Output Capacity', value: '10,000 t/y High-Purity Isolate' }
    ]
  },
  {
    slug: 'solbar-nebraska',
    category: 'DEEP SOY PROCESSING',
    categoryNumber: '01',
    title: 'SOLBAR NEBRASKA',
    country: 'USA',
    years: '2009–2011',
    type: 'Flagship US Regional Processing Facility',
    overview: 'Launch of the largest plant in the region. Technological superiority allowed the company to reach a new round of capitalization and capture premier North American market share.',
    scope: [
      'Engineering documentation aligned with US building codes and FDA standards',
      'High-throughput continuous enzymatic hydrolysis and membrane filtration',
      'Advanced instrumentation, automation and remote diagnostic systems',
      'Supervision of mechanical and electrical installation contractors',
      'Validation protocols and commercial ramp-up support'
    ],
    technology: 'Advanced Enzymatic & Hydro-Mechanical Soy Isolation',
    results: [
      'Regional processing benchmark in the Midwest agricultural corridor',
      'Strategic market expansion leading to enterprise capital appreciation',
      'Compliance with strict US FDA, GMP and sanitary guidelines'
    ],
    image: '/images/projects/solbar-nebraska.jpg',
    gallery: [
      '/images/projects/solbar-nebraska.jpg'
    ],
    relatedTechSlug: 'soy-protein',
    specs: [
      { label: 'Location', value: 'Nebraska, United States' },
      { label: 'Project Period', value: '2009–2011' },
      { label: 'Technology Profile', value: 'Aqueous Extraction & Hydrolysis' },
      { label: 'Regulatory Code', value: 'FDA, GMP, 3-A Sanitary' }
    ]
  },
  {
    slug: 'siberian-wellness',
    category: 'PECTIN AND FUNCTIONAL COMPONENTS',
    categoryNumber: '02',
    title: 'SIBERIAN WELLNESS PLANT',
    country: 'Uzbekistan',
    years: '2023–2025',
    capacity: '500 t/y Pectin · 800 t/y Dietary Fibers',
    type: 'Hybrid Bio-Refining & Extraction Complex',
    overview: 'Turnkey construction of a state-of-the-art plant for Siberian Wellness (Namangan, Uzbekistan). The hybrid design enables pectin, inulin, and dietary fiber production with full automation.',
    scope: [
      'Complete EPCM engineering cycle from concept to live production',
      'Implementation of patented cavitation extraction technology (Application No. 113754)',
      'Multi-tier open steel frame extraction tower fabrication and erection',
      'Alcohol-free, organic-acid extraction and vacuum concentration equipment',
      'Turnkey SCADA digital twin control room integration'
    ],
    technology: "Eco-Friendly 'Green' Pectin & Dietary Fiber Production (Patent 113754)",
    results: [
      '500 metric tons annual high-purity pectin production',
      '800 metric tons annual purified dietary fibers',
      '100% alcohol-free process ensuring exceptional food safety'
    ],
    image: '/images/projects/siberian-wellness.jpg',
    gallery: [
      '/images/projects/siberian-wellness.jpg'
    ],
    relatedTechSlug: 'pectin',
    specs: [
      { label: 'Location', value: 'Namangan, Uzbekistan' },
      { label: 'Execution Timeline', value: '2023–2025' },
      { label: 'Raw Feedstocks', value: 'Apple Pomace, Jerusalem Artichoke' },
      { label: 'Contract Format', value: 'Full-Cycle Turnkey EPCM' }
    ]
  },
  {
    slug: 'agritech-kazakhstan',
    category: 'DEEP SOY PROCESSING',
    categoryNumber: '01',
    title: 'AGRITECH LLC SOY PLANT',
    country: 'Kazakhstan',
    years: '2019–2021',
    type: 'Soy Protein Isolate Production Facility',
    overview: 'Located in Zhanatlab Village, Almaty Region, Republic of Kazakhstan. Client: Agritech LLC. The project involved the design and development of a modern soybean deep processing facility for high-quality isolate for the food industry.',
    scope: [
      'Comprehensive plant architectural and engineering design',
      'Implementation of Patent RU 2709384 C1 enzymatic hydrolysis line',
      'Instant steam thermal shock (135–140°C) and vacuum deodorization system',
      'Bromelain micro-dose precision injection system',
      'Installation of cleanroom spray drying and packaging line'
    ],
    technology: 'Innovative Enzymatic Hydrolysis Soy Isolate (Patent RU 2709384 C1)',
    results: [
      'Protein solubility enhanced by 6.8 times via controlled peptide cleavage',
      'Elimination of specific beany soy odor through flash vacuum cooling',
      'Light-colored, low-viscosity isolate meeting international standards'
    ],
    image: '/images/projects/agritech-kazakhstan.jpg',
    gallery: [
      '/images/projects/agritech-kazakhstan.jpg'
    ],
    relatedTechSlug: 'soy-protein',
    specs: [
      { label: 'Location', value: 'Zhanatlab, Almaty Region, Kazakhstan' },
      { label: 'Client', value: 'Agritech LLC' },
      { label: 'Project Period', value: '2019–2021' },
      { label: 'Patent Applied', value: 'Patent RU 2709384 C1' }
    ]
  },
  {
    slug: 'aznar-pomegranate',
    category: 'PECTIN AND FUNCTIONAL COMPONENTS',
    categoryNumber: '02',
    title: 'AZNAR POMEGRANATE COMPLEX',
    country: 'Azerbaijan',
    years: '2015–2017',
    type: 'Pomegranate Agro-Waste Valorization Complex',
    overview: 'Industrial facility for deep processing of pomegranate processing residues. Extraction of high-value pectin, pharmaceutical tannins, and purified dietary fibers from pomegranate peel.',
    scope: [
      'Technological audit and by-product valorization engineering',
      'Pilot-scale extraction trials and solvent-free recovery process',
      'Commercial line design for peeling, separation and drying',
      'Tannin purification and high-viscosity hydrocolloid lines'
    ],
    technology: 'Bioactive Pomegranate Peel Valorization & Extraction',
    results: [
      'Zero-waste conversion of seasonal pomegranate juicing side-streams',
      'Commercial production of high-grade natural tannins and pectin',
      'Significant economic ROI for client processing assets'
    ],
    image: '/images/projects/aznar-pomegranate.jpg',
    gallery: [
      '/images/projects/aznar-pomegranate.jpg'
    ],
    relatedTechSlug: 'pomegranate',
    specs: [
      { label: 'Location', value: 'Goychay, Azerbaijan' },
      { label: 'Feedstock Source', value: 'Pomegranate Press Peel' },
      { label: 'Primary Products', value: 'Pectin, Tannin, Fibers' },
      { label: 'Environmental Impact', value: 'Zero Landfill Agro-Waste' }
    ]
  },
  {
    slug: 'cargill-brazil',
    category: 'DEEP SOY PROCESSING',
    categoryNumber: '01',
    title: 'CARGILL BRAZIL CONSULTING',
    country: 'Brazil',
    years: '2018',
    type: 'Engineering & Process Modernization',
    overview: 'Consulting support and engineering design of an industrial plant in Brazil for CARGILL Inc. (USA), optimizing process efficiencies and yield parameters.',
    scope: [
      'Comprehensive technological audit of existing extraction lines',
      'Process debottlenecking and mass balance recalculation',
      'Energy integration and steam consumption reduction studies',
      'Recommendations on membrane separation efficiency'
    ],
    technology: 'Advanced Industrial Soy Processing & Mass Balance Optimization',
    results: [
      'Operational debottlenecking for global agricultural multinational',
      'Validated technological expertise across international standards'
    ],
    image: '/images/tech_integrated_plant_1790271239031.jpg',
    gallery: [
      '/images/tech_integrated_plant_1790271239031.jpg'
    ],
    relatedTechSlug: 'soy-protein',
    specs: [
      { label: 'Client', value: 'CARGILL Inc. (USA / Brazil)' },
      { label: 'Year', value: '2018' },
      { label: 'Scope', value: 'Process Consulting & Optimization' }
    ]
  },
  {
    slug: 'yantai-dsm-andre-pectin',
    category: 'PECTIN AND FUNCTIONAL COMPONENTS',
    categoryNumber: '02',
    title: 'YANTAI DSM ANDRE PECTIN',
    country: 'China',
    years: '2018',
    type: 'Industrial Capacity Modernization',
    overview: 'Engineering consulting and modernization of production capacities for Yantai DSM Andre Pectin, one of the world largest manufacturers of hydrocolloids.',
    scope: [
      'Cavitation extraction and filtration optimization review',
      'Chemical reagent reduction and purity enhancement schemes',
      'Advanced instrumentation and process parameter automation'
    ],
    technology: 'Large-Scale Pectin Purification & Yield Maximization',
    results: [
      'Enhanced recovery rates for citrus and apple pomace processing',
      'Consolidation of technological leadership in Asian hydrocolloid market'
    ],
    image: '/images/tech_pectin_apples_1790271159655.jpg',
    gallery: [
      '/images/tech_pectin_apples_1790271159655.jpg'
    ],
    relatedTechSlug: 'pectin',
    specs: [
      { label: 'Client', value: 'DSM Andre Pectin' },
      { label: 'Location', value: 'Yantai, Shandong, China' },
      { label: 'Year', value: '2018' }
    ]
  }
];

// ==========================================
// 2. TECHNOLOGIES FACTUAL DATA
// ==========================================
export const TECHNOLOGIES_DATA: TechnologyItem[] = [
  {
    slug: 'pectin',
    categoryNumber: '01',
    categoryTitle: 'PECTIN & DIETARY FIBERS',
    title: "Eco-Friendly 'Green' Pectin & Dietary Fiber Production",
    subtitle: 'Alcohol-free cavitation extraction for pharmaceutical and food-grade hydrocolloids',
    overview: 'Pectin and dietary fibers are high-demand ingredients for the food and cosmetics industries. Modern market demands require high product purity and a transition to safe, non-toxic extraction methods. Soltex patented technology completely replaces harsh chemical reagents with gentle cavitation and organic catalysts.',
    patentInfo: {
      patentNumber: 'Patent Application No. 113754',
      location: 'Commercial installation: Namangan, Uzbekistan (Siberian Wellness)',
      keyPoints: [
        'Alcohol-Free Green Standard: completely eliminates the use of alcohols, ensuring absolute food safety and simplified permitting.',
        'Minimal Chemical Footprint: instead of aggressive acid-base catalysts, a mild organic acid is applied in minimal quantities.',
        'Gentle Purification: washes out ballast substances, mild processing, and membrane filtration to preserve the native molecular structure.'
      ]
    },
    rawMaterials: ['Apple Pomace', 'Citrus Peel (Orange, Lemon, Lime)', 'Sugar Beet Marc', 'Pomegranate Residues'],
    processPrinciples: [
      { title: 'Hydrodynamic Cavitation', description: 'Intense micro-implosions rupture plant cell walls without thermal degradation, releasing intact pectin chains.' },
      { title: 'Organic Acid Hydrolysis', description: 'Replaces hydrochloric and nitric acids with food-grade organic acids, eliminating chloride corrosion and toxic effluents.' },
      { title: 'Membrane Ultrafiltration', description: 'Multi-stage concentration and diafiltration removes low-molecular-weight sugars and bitter polyphenols without precipitation by alcohol.' },
      { title: 'Low-Temperature Vacuum Drying', description: 'Gentle dehydration preserves gelling capability (USA SAG rating) and optimal degree of esterification.' }
    ],
    keyAdvantages: [
      'Elimination of flammable alcohol recovery cycles and explosion-proof zoning costs',
      'Reduction of freshwater consumption by up to 60% through closed-loop recirculation',
      'Preservation of high molecular weight and superior gelling strength',
      'Simultaneous co-production of purified insoluble and soluble dietary fibers'
    ],
    applications: [
      'Confectionery, jellies, marmalades and bakery fillings (High-Methoxyl)',
      'Low-sugar fruit preserves, dairy and yogurt fruit preps (Low-Methoxyl)',
      'Pharmaceutical encapsulation, detox formulations and nutraceuticals',
      'Natural cosmetic emulsion stabilizing and moisture-binding hydrogels'
    ],
    productsProduced: [
      'High-Methoxyl (HM) Pectin (60–75% esterification)',
      'Low-Methoxyl (LM) & Amidated Pectin',
      'Purified Soluble Apple/Citrus Fibers',
      'Insoluble Micro-milled Dietary Fiber (up to 85% TDF)'
    ],
    relatedProjects: ['siberian-wellness', 'yantai-dsm-andre-pectin', 'aznar-pomegranate'],
    image: '/images/tech_pectin_apples_1790271159655.jpg'
  },
  {
    slug: 'soy-protein',
    categoryNumber: '02',
    categoryTitle: 'SOY PROTEIN & BIOCHEMISTRY',
    title: 'Innovative Soy Protein Isolate Production: Enzymatic Hydrolysis',
    subtitle: 'Micro-dose bromelain hydrolysis and flash steam deodorization for high-solubility isolate',
    overview: 'Soy protein isolate is a high-margin product in demand for sports and baby nutrition, meat processing, and dairy alternatives. Soltex proprietary process eliminates the main drawbacks of traditional extraction: raw material loss, high reagent costs, and poor solubility.',
    patentInfo: {
      patentNumber: 'Patent RU 2709384 C1',
      location: 'Implemented at modern facilities in Israel, China, USA and Kazakhstan',
      keyPoints: [
        'Optimized Hydrolysis: expensive enzyme (bromelain) is used in micro-doses (0.2–1%) and is added only to protein already purified from fiber and sugars, radically reducing processing costs.',
        'Perfect Digestibility: cleaving the molecular lattice into small peptides (up to 10 kDa) increases the solubility of the final product by 6.8 times.',
        'Premium Organoleptics: instant steam thermal shock (135–140°C for 0.2 sec) followed by rapid vacuum cooling (to 55°C) vaporizes specific soy odor without protein denaturation.'
      ]
    },
    rawMaterials: ['Defatted White Flake (PDI > 80)', 'Non-GMO Soybean Meal', 'Whole Soybeans'],
    processPrinciples: [
      { title: 'Aqueous Alkaline Extraction', description: 'Mild dissolution of globular proteins at pH 8.0–8.5 with high solid-to-liquid separation efficiency.' },
      { title: 'Isoelectric Precipitation', description: 'Rapid separation of globulins at isoelectric point (pH 4.5), recovering clear whey side-stream.' },
      { title: 'Targeted Enzymatic Cleavage', description: 'Micro-dosed bromelain breaks bitter hydrophobic bonds without over-hydrolyzing into free amino acids.' },
      { title: 'Flash Steam Deodorization', description: 'Ultra-fast direct steam contact flash vaporizes hexanal and volatile beany ketones.' }
    ],
    keyAdvantages: [
      '6.8x increase in nitrogen solubility index (NSI > 85%) across wide pH ranges',
      'Ultra-neutral flavor profile suitable for premium dairy and sports beverages',
      'Lower enzyme consumption cost compared to conventional whole-mash enzymatic plants',
      'Full byproduct valorization: soy fiber, phosphatide emulsion, and purified soy oil'
    ],
    applications: [
      'Sports nutrition protein shakes and clinical dietary blends',
      'Infant formulas and functional plant-based dairy alternatives',
      'Brine injection for whole muscle meat and emulsion sausages',
      'Protein fortification in bakery, snacks and confectionery bars'
    ],
    productsProduced: [
      'Soy Protein Isolate (≥90% dry basis protein content)',
      'Functional Soy Concentrates (≥70% protein)',
      'Dietary Soy Cotyledon Fiber (≥75% dietary fiber)',
      'Lecithin & Phosphatide Emulsion'
    ],
    relatedProjects: ['solbar-israel', 'solbar-ningbo', 'solbar-nebraska', 'agritech-kazakhstan', 'cargill-brazil'],
    image: '/images/tech_soy_beans_1790271178494.jpg'
  },
  {
    slug: 'inulin',
    categoryNumber: '03',
    categoryTitle: 'INULIN & PREBIOTIC FRACTIONS',
    title: 'Jerusalem Artichoke & Chicory Deep Inulin Processing',
    subtitle: 'Continuous counter-current diffusion and chromatographic purification for prebiotic fibers',
    overview: 'Soltex delivers industrial extraction lines for Jerusalem artichoke tubers and chicory roots, producing pure inulin powder, fructooligosaccharides (FOS), and natural prebiotic syrups for diabetes care and gut health.',
    rawMaterials: ['Jerusalem Artichoke Tubers', 'Chicory Roots', 'Agave Stems'],
    processPrinciples: [
      { title: 'Gentle Counter-Current Diffusion', description: 'Multi-stage heated water leaching preserves high polymerization degree (DP 10–35).' },
      { title: 'Decolorization & Ultrafiltration', description: 'Removal of pigments, proteins, and polyphenols without aggressive chemical bleaching.' },
      { title: 'Chromatographic Ion Exchange', description: 'Fractionation of long-chain inulin from mono- and disaccharides for high purity grades.' },
      { title: 'Controlled Crystallization & Spray Drying', description: 'Low-temperature evaporation ensuring non-caking, free-flowing crystalline powder.' }
    ],
    keyAdvantages: [
      'Complete extraction yield of fructans exceeding 92% of dry tuber mass',
      'Option for co-production of functional fructose syrups (BRIX 70+)',
      'Zero waste: press cake converted into animal feed pellets or dietary fiber',
      'Energy integration with factory steam condensation recovery'
    ],
    applications: [
      'Sugar and fat replacement in chocolates, baked goods and dairy',
      'Clinical nutrition and glycemic control dietary supplements',
      'Baby foods and digestive prebiotic formulation',
      'Functional beverages and dietary prebiotic fibers'
    ],
    productsProduced: [
      'Standard Inulin Powder (DP 10–12)',
      'High-Performance (HP) Long-Chain Inulin (DP > 23)',
      'Fructooligosaccharide (FOS) Syrups & Powders',
      'Jerusalem Artichoke Dietary Fiber Flour'
    ],
    relatedProjects: ['siberian-wellness'],
    image: '/images/tech_inulin_roots_1790271193455.jpg'
  },
  {
    slug: 'pomegranate',
    categoryNumber: '04',
    categoryTitle: 'BIOACTIVE RESIDUES & TANNINS',
    title: 'Pomegranate Processing Revolution: Tannin, Pectin & Seed Oil',
    subtitle: 'Comprehensive agro-waste valorization converting juicing side-streams into high-value compounds',
    overview: 'Pomegranate juicing leaves over 50% of the fruit weight as peel and seeds. Soltex turnkey technology transforms this agro-industrial waste into pharmaceutical tannins, food-grade pectin, and punicalagin-rich antioxidants.',
    rawMaterials: ['Pomegranate Peel & Carpellary Membranes', 'Pomegranate Seeds', 'Grape Marc'],
    processPrinciples: [
      { title: 'Differential Milling & Washing', description: 'Clean physical separation of seeds from pericarp tissue.' },
      { title: 'Selective Solvent-Free Extraction', description: 'Multi-stage countercurrent washing recovering punicalagins and ellagic acid.' },
      { title: 'Pectin Hydrolysis & Fractionation', description: 'Extraction of unique high-viscosity pomegranate peel pectin.' },
      { title: 'Cold-Press & Supercritical Seed Oil Extraction', description: 'Recovery of rare conjugated fatty acids (punicic acid > 70%).' }
    ],
    keyAdvantages: [
      'Full commercial monetization of fruit processing residues',
      'Production of highly sought-after natural preservatives and cosmetics active ingredients',
      'Zero-discharge wastewater management with clean solid fuel cake'
    ],
    applications: [
      'Natural antioxidants and active cosmetics formulations',
      'Pharmaceutical cardiovascular and anti-inflammatory extracts',
      'Specialty baking texturizers and astringent hydrocolloids'
    ],
    productsProduced: [
      'Pomegranate Peel Pectin',
      'Purified Ellagitannins & Punicalagin Extract (≥40%)',
      'Virgin Pomegranate Seed Oil (Omega-5 Punicic Acid)',
      'Dietary Pomegranate Fiber Flour'
    ],
    relatedProjects: ['aznar-pomegranate'],
    image: '/images/tech_citrus_oranges_1790271213504.jpg'
  },
  {
    slug: 'dietary-fibers',
    categoryNumber: '05',
    categoryTitle: 'PLANT FIBERS & TEXTURIZERS',
    title: 'Purified Dietary Fibers: Apple, Citrus, Beet & Grains',
    subtitle: 'Micro-milling and gentle thermal activation for superior water and oil retention',
    overview: 'Industrial micronization and solvent-free extraction systems for producing soluble and insoluble dietary fibers from fruit pomace, grain, and vegetable processing side-streams.',
    rawMaterials: ['Apple Pomace', 'Citrus Marc', 'Sugar Beet Pulp', 'Wheat & Oat Bran'],
    processPrinciples: [
      { title: 'Ballast Sugar Leaching', description: 'Mild water washing to remove residual mono- and disaccharides without fiber breakdown.' },
      { title: 'Sterilization & Gentle Dehydration', description: 'Rapid flash drying preventing caramelization and preserving capillary porosity.' },
      { title: 'Jet-Milling & Micronization', description: 'Precise particle size classification from 50 to 250 microns for smooth mouthfeel.' }
    ],
    keyAdvantages: [
      'High water-holding capacity (1:8 to 1:12) and oil-binding capacity (1:4 to 1:6)',
      'Clean label ingredient replacing chemical emulsifiers and modified starches',
      'Neutral color and odor with long shelf-life stability'
    ],
    applications: [
      'Meat emulsions, minced cutlets and sausages (yield increase and fat replacement)',
      'Bakery and breadmaking (freshness preservation and crumb softness)',
      'Extruded breakfast cereals, pasta and dietary snacks'
    ],
    productsProduced: [
      'Apple Dietary Fiber Powder',
      'Citrus Fiber (High Hydration Capacity)',
      'Sugar Beet Dietary Fiber',
      'Micro-milled Oat and Wheat Fibers'
    ],
    relatedProjects: ['siberian-wellness', 'aznar-pomegranate'],
    image: '/images/tech_citrus_oranges_1790271213504.jpg'
  },
  {
    slug: 'concentrated-bases',
    categoryNumber: '06',
    categoryTitle: 'CONCENTRATES & PUREES',
    title: 'Automated Lines for Concentrated Juices & Bases',
    subtitle: 'Falling film evaporation and aseptic filling for premium BRIX 70 fruit concentrates',
    overview: 'Soltex designs and installs high-capacity automated lines for the concentration of fruit juices, vegetable purees, and clear concentrates up to BRIX 70 with full aroma recovery systems.',
    rawMaterials: ['Apples', 'Grapes', 'Pomegranates', 'Tomatoes', 'Berries', 'Carrots'],
    processPrinciples: [
      { title: 'Enzymatic Clarification & Microfiltration', description: 'Depectinization and ceramic crossflow filtration for crystal clarity.' },
      { title: 'Multi-Effect Falling Film Evaporators', description: 'Low-temperature vacuum boiling with minimal thermal load on fruit nutrients.' },
      { title: 'Integrated Aroma Recovery', description: 'Condensation of delicate volatile natural top notes for standard back-blending.' },
      { title: 'Aseptic Bag-in-Box / Drum Filling', description: 'Sterile high-speed filling for long ambient logistics.' }
    ],
    keyAdvantages: [
      'Production of premium clarity concentrates (BRIX 70) and dense purees (BRIX 36+)',
      'Thermal efficiency through mechanical vapor recompression (MVR)',
      'Fully automated CIP/SIP sanitization cycles'
    ],
    applications: [
      'Beverage bottling and soft drink reconstitution',
      'Confectionery syrups, jams and jelly fillings',
      'Fruit base preparations for dairy and baby foods'
    ],
    productsProduced: [
      'Clear Apple Juice Concentrate (BRIX 70)',
      'Pomegranate Concentrate (BRIX 65)',
      'Grape Must & Juices',
      'Aseptic Fruit Purees (BRIX 36+)'
    ],
    relatedProjects: ['aznar-pomegranate'],
    image: '/images/tech_lab_flasks_1790271257443.jpg'
  }
];

// ==========================================
// 3. PRODUCTS FACTUAL DATA
// ==========================================
export const PRODUCTS_DATA: ProductItem[] = [
  {
    slug: 'pectin',
    categoryNumber: '01',
    categoryTitle: 'HYDROCOLLOIDS & GELLING AGENTS',
    title: 'Food & Pharmaceutical Grade Pectin',
    description: 'Purified biopolymers produced via patented alcohol-free cavitation extraction from apple pomace, citrus peels, and sugar beet pulp.',
    rawMaterials: ['Apple Pomace', 'Citrus Peel', 'Sugar Beet Marc'],
    productionTechnology: 'Alcohol-free hydrodynamic cavitation extraction and membrane ultrafiltration (Patent Application No. 113754)',
    applications: [
      'Confectionery: jellies, gummies, fruit pastes, bakery glazes',
      'Dairy: drinkable yogurts, sour cream structure stabilization, acidified milk drinks',
      'Beverages: mouthfeel optimization, fruit suspension in nectars',
      'Pharmaceuticals: capsule excipients, gastro-protective formulations'
    ],
    characteristics: [
      'Degree of esterification tailored from 30% to 75%',
      'Exceptional gel elasticity and thermal reversibility',
      'Clean label, non-GMO, certified Kosher and Halal compliant',
      'Free of residual chemical solvent traces'
    ],
    relatedTechSlug: 'pectin',
    relatedProjectSlug: 'siberian-wellness',
    image: '/images/tech_pectin_apples_1790271159655.jpg'
  },
  {
    slug: 'soy-protein-isolate',
    categoryNumber: '02',
    categoryTitle: 'PLANT PROTEIN ISOLATES',
    title: 'Enzymatically Hydrolyzed Soy Protein Isolate (≥90%)',
    description: 'High-purity plant protein isolate with elevated solubility index and neutral organoleptics, produced via targeted micro-dose enzymatic hydrolysis.',
    rawMaterials: ['Non-GMO Defatted Soybean White Flakes (PDI > 80)'],
    productionTechnology: 'Aqueous extraction, micro-dose bromelain hydrolysis, and steam flash deodorization (Patent RU 2709384 C1)',
    applications: [
      'Sports nutrition protein powders, dry blends and ready-to-drink shakes',
      'Meat processing: brine injection, boiled sausages, minced meat extension',
      'Plant-based dairy: soy milks, tofu, vegan yogurts and desserts',
      'Functional nutrition bars and clinical dietary supplements'
    ],
    characteristics: [
      'Crude protein content ≥90% on dry basis',
      'Nitrogen Solubility Index (NSI) > 85%',
      'Peptide cleavage < 10 kDa ensuring 6.8x increased digestibility',
      'Virtually zero beany odor or bitter aftertaste'
    ],
    relatedTechSlug: 'soy-protein',
    relatedProjectSlug: 'agritech-kazakhstan',
    image: '/images/tech_soy_beans_1790271178494.jpg'
  },
  {
    slug: 'inulin-fos',
    categoryNumber: '03',
    categoryTitle: 'FUNCTIONAL PREBIOTICS & SWEETENERS',
    title: 'Inulin & Fructooligosaccharides (FOS)',
    description: 'Natural prebiotic dietary fructans extracted from Jerusalem artichoke tubers and chicory roots, offering gut health benefits and sugar/fat replacement.',
    rawMaterials: ['Jerusalem Artichoke Tubers (Helianthus tuberosus)', 'Chicory Roots'],
    productionTechnology: 'Multi-stage countercurrent aqueous diffusion, decolorization and low-temperature crystallization',
    applications: [
      'Dairy & Ice Cream: fat replacer imparting creamy mouthfeel without caloric burden',
      'Bakery: moisture retention and dietary fiber fortification',
      'Specialty Nutrition: glycemic control for diabetic nutrition',
      'Dietary supplements: prebiotic capsules and soluble gut health sachets'
    ],
    characteristics: [
      'Polymerization degree available in short (DP 3–10) and long chain (DP > 23)',
      'Pure white crystalline powder, highly soluble in liquids',
      'Caloric value under 1.5 kcal/g with low glycemic index',
      'Promotes beneficial bifidobacteria growth in microflora'
    ],
    relatedTechSlug: 'inulin',
    relatedProjectSlug: 'siberian-wellness',
    image: '/images/tech_inulin_roots_1790271193455.jpg'
  },
  {
    slug: 'dietary-fibers',
    categoryNumber: '04',
    categoryTitle: 'STRUCTURAL TEXTURIZERS & FIBERS',
    title: 'Purified Soluble & Insoluble Dietary Fibers',
    description: 'High-fiber natural ingredients from apple, citrus, and beet by-products, engineered for optimal water and oil absorption in food production.',
    rawMaterials: ['Apple Pomace', 'Citrus Marc', 'Sugar Beet Marc'],
    productionTechnology: 'Micro-washing, gentle thermal sterilization and air-classifier micronization',
    applications: [
      'Processed meats and sausages: binding purge liquids and preventing shrinkage',
      'Bakery products: extending shelf life and preventing staling',
      'Prepared sauces and dressings: natural viscosity without synthetic gums'
    ],
    characteristics: [
      'Total Dietary Fiber (TDF) ≥ 75–85%',
      'Water binding capacity 1:8 to 1:12',
      'Neutral pleasant aroma and fine particle size (100–200 mesh)',
      '100% natural, clean label declaration'
    ],
    relatedTechSlug: 'dietary-fibers',
    relatedProjectSlug: 'siberian-wellness',
    image: '/images/tech_citrus_oranges_1790271213504.jpg'
  },
  {
    slug: 'concentrated-bases',
    categoryNumber: '05',
    categoryTitle: 'NATURAL BASES & EXTRACTS',
    title: 'Concentrated Natural Juices & Bases (BRIX 70)',
    description: 'High-density natural fruit and berry concentrates and purees processed under low vacuum conditions with integrated volatile aroma capture.',
    rawMaterials: ['Fresh Apples', 'Pomegranates', 'Grapes', 'Berries', 'Tomatoes'],
    productionTechnology: 'Enzymatic depectinization, cross-flow filtration, multi-effect vacuum evaporation, and aseptic packaging',
    applications: [
      'Reconstituted premium 100% juices and fruit nectars',
      'Confectionery jellies, gummy candy bases and fruit preps',
      'Brewing, cider production and flavored beverage syrups'
    ],
    characteristics: [
      'Concentration up to BRIX 70 with absolute optical clarity',
      'Intact volatile natural aroma profile returned to concentrate',
      'Zero added sugars, preservatives or chemical colorants',
      'Aseptic 200L drums and bag-in-box long-term ambient storage'
    ],
    relatedTechSlug: 'concentrated-bases',
    relatedProjectSlug: 'aznar-pomegranate',
    image: '/images/tech_lab_flasks_1790271257443.jpg'
  },
  {
    slug: 'bioactive-compounds',
    categoryNumber: '06',
    categoryTitle: 'PHARMACEUTICAL INGREDIENTS',
    title: 'Plant Bioactive Extracts & Specialty Oils',
    description: 'Rare active botanical compounds including natural pomegranate tannins, amaranth oil (squalene), and high-purity phytosterols.',
    rawMaterials: ['Pomegranate Seeds & Rinds', 'Amaranth Grains', 'Grape Seeds'],
    productionTechnology: 'Supercritical CO2 extraction, countercurrent solvent-free extraction, and molecular distillation',
    applications: [
      'Pharmaceutical active ingredients and antioxidant supplements',
      'Anti-aging cosmetics, serums and dermatological formulations',
      'Functional health oils and cardioprotective nutritional blends'
    ],
    characteristics: [
      'High concentrations of target bioactives (e.g. Squalene up to 8% in amaranth oil)',
      'Punicalagin purity > 40% in dry extract form',
      'Zero solvent residue, cold extraction at sub-critical temperatures',
      'Certified for cosmetics and dietary supplement safety standards'
    ],
    relatedTechSlug: 'pomegranate',
    relatedProjectSlug: 'aznar-pomegranate',
    image: '/images/tech_integrated_plant_1790271239031.jpg'
  }
];

// ==========================================
// 5. GLOBAL OFFICES & CONTACT DATA
// ==========================================
export const GLOBAL_OFFICES: OfficeLocation[] = [
  {
    region: 'EUROPEAN OFFICE',
    title: 'SOLTEX GROUP LTD',
    country: 'Bulgaria',
    representative: 'Oleg Radinovcky',
    phone: '+359 87 826 77 82',
    email: 'Oleg.radinovcky@gmail.com',
    whatsapp: '+359 87 826 77 82'
  },
  {
    region: 'ISRAEL OFFICE',
    title: 'SOLTEX GROUP LTD',
    country: 'Israel',
    address: 'P.O.B. 3142 Tel-Aviv, 61031 ISRAEL',
    representative: 'Yariv Goldman',
    phone: '+972 50-223-0395',
    email: 'Yariv.goldman@gmail.com',
    whatsapp: '+972 50-223-0395'
  },
  {
    region: 'ASIAN OFFICE',
    title: 'SOLTEX GROUP LTD',
    country: 'Kazakhstan, Almaty',
    representative: 'Alexandr Trikutko',
    phone: '+7 707 188 18 88',
    email: 'Trikutko@gmail.com',
    whatsapp: '+7 707 188 18 88'
  },
  {
    region: 'CHINA OFFICE',
    title: 'SOLTEX GROUP LTD',
    country: 'China',
    address: 'No. 151 Zhongcui Street, Dalian, China P.C. 116015',
    email: 'info@soltexglobal.co'
  }
];

// ==========================================
// 6. PATENTS & IP FACTUAL DATA
// ==========================================
export const PATENTS_DATA = [
  {
    number: '01',
    code: 'PATENT APPLICATION NO. 113754',
    title: "Eco-Friendly 'Green' Pectin & Dietary Fiber Production Technology",
    location: 'Namangan, Uzbekistan · Siberian Wellness Plant',
    overview: 'Advanced hydrodynamic cavitation extraction of pectin and dietary fibers. This innovation has been successfully scaled and is in operation at one of the most advanced bio-refining plants in Asia, proving its commercial and environmental efficiency.',
    keyPillars: [
      {
        title: 'Alcohol-Free Green Standard',
        description: 'The technology completely eliminates the use of alcohols in the precipitation phase, ensuring absolute food safety of the final product and minimizing fire hazard zoning.'
      },
      {
        title: 'Minimal Chemical Footprint',
        description: 'Instead of aggressive hydrochloric or nitric acid-base catalysts, a mild food-grade organic acid is applied in minimal quantities.'
      },
      {
        title: 'Gentle Purification',
        description: 'The process includes washing out ballast substances, mild processing, and membrane ultrafiltration to obtain a pure solid yield that preserves the natural macromolecular structure.'
      }
    ],
    industrialImplementation: 'Siberian Wellness Turnkey Bio-Refining Facility (500 t/y Pectin, 800 t/y Dietary Fibers)'
  },
  {
    number: '02',
    code: 'PATENT RU 2709384 C1',
    title: 'Innovative Soy Protein Isolate Production: Enzymatic Hydrolysis Technology',
    location: 'Almaty Region, Kazakhstan · Agritech LLC Plant',
    overview: 'The method eliminates the main drawbacks of traditional isolate production: raw material protein loss, high reagent costs, and poor water solubility. This innovation has been successfully scaled across modern plants in Israel, China, USA, and Kazakhstan.',
    keyPillars: [
      {
        title: 'Optimized Hydrolysis',
        description: 'The expensive enzyme (bromelain) is used in micro-doses (0.2–1%) and is added only to the protein already purified from fiber and sugars, radically reducing processing costs.'
      },
      {
        title: 'Perfect Digestibility',
        description: 'Cleaving the molecular lattice into small peptides (up to 10 kDa) increases the water solubility of the final product by 6.8 times compared to standard isolates.'
      },
      {
        title: 'Premium Organoleptics',
        description: 'Instant steam thermal shock (135–140°C for 0.2 sec) followed by rapid vacuum cooling (to 55°C) vaporizes specific soy odors without protein denaturation, yielding a homogeneous, light-colored isolate.'
      }
    ],
    industrialImplementation: 'Agritech LLC Soybean Processing Complex (Zhanatlab, Kazakhstan) and Solbar industrial assets worldwide'
  }
];

// ==========================================
// 7. COMPANY HISTORY TIMELINE
// ==========================================
export const COMPANY_TIMELINE = [
  {
    year: '1999',
    title: 'FOUNDATION AND START',
    description: 'Soltex Group began its activities as a technology platform for promoting advanced Israeli engineering and separation technologies on the world market.'
  },
  {
    year: '2001 – 2004',
    title: 'FIRST MASSIVE ASSET',
    description: 'Design and launch of the Solbar plant (Israel) for the production of soy protein isolate (17,000 t/y). Successfully operating on our patented technologies for over 18 years.'
  },
  {
    year: '2006 – 2008',
    title: 'EXPANSION INTO ASIA (NINGBO)',
    description: 'Turnkey engineering and commissioning of the Solbar Ningbo plant in China (10,000 t/y isolate), establishing global quality and purity benchmarks.'
  },
  {
    year: '2009 – 2011',
    title: 'NORTH AMERICAN MARKET ENTRY',
    description: 'Commissioning of Solbar Nebraska in the United States, creating the premier high-capacity soy processing asset in the Midwest region.'
  },
  {
    year: '2010 – 2014',
    title: 'SCIENTIFIC BREAKTHROUGH IN EUROPE',
    description: 'R&D at the Girona University Science Park (Spain). Soltex developed a unique hydrodynamic cavitation technology to obtain high-purity pectin without aggressive acids or alcohols.'
  },
  {
    year: '2018',
    title: 'GLOBAL RECOGNITION & MODERNIZATION',
    description: 'Consulting support and engineering design of an industrial plant in Brazil for CARGILL Inc. (USA) and modernization of capacities for Yantai DSM Andre Pectin (China).'
  },
  {
    year: '2019 – 2021',
    title: 'SOY DEEP PROCESSING PLANT IN KAZAKHSTAN',
    description: 'Location: Zhanatlab Village, Almaty Region, Republic of Kazakhstan. Client: Agritech LLC. Design and development of a modern soybean deep processing facility for high-quality isolate.'
  },
  {
    year: '2023 – 2025',
    title: 'FLAGMAN HYBRID COMPLEX IN CIS',
    description: 'Turnkey construction of a plant for Siberian Wellness (Uzbekistan). The hybrid design allows for pectin, inulin, and dietary fiber production with full SCADA automation.'
  }
];

// ==========================================
// 8. PUBLIC SCALE & INFRASTRUCTURE CAPABILITIES
// ==========================================
export const PUBLIC_SCALE_EXPERIENCE = [
  {
    title: 'SAFE CITY SYSTEMS',
    description: 'Implementation of intelligent video surveillance networks and high-security control rooms in Nigeria (2006) and Argentina (2010).'
  },
  {
    title: 'CRITICAL INFRASTRUCTURE PROTECTION',
    description: 'Security design and technical integration for international airports (Kinshasa, Ramon) and presidential facilities, including biometric identification and protected server centers.'
  },
  {
    title: 'ENERGY INDEPENDENCE',
    description: 'Implementation of projects on alternative energy, renewable sources, waste-to-energy co-generation, and high-performance industrial generator systems.'
  }
];
