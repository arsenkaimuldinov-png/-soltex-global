import { CompanyVideo, VideoMaterial, KeyDirection, SectorApplication, WhySoltexReason, EpcmStage } from '../types';

export const HERO_DATA = {
  eyebrow: "INTERNATIONAL EPC / EPCM ENGINEERING GROUP",
  headline: "Turnkey engineering for advanced plant processing",
  description: "From feasibility studies and technology selection to engineering, equipment supply, construction, commissioning and operational support — Soltex delivers industrial processing plants for high-value ingredients.",
  primaryCta: "START YOUR PROJECT",
  secondaryCta: "EXPLORE TECHNOLOGIES",
  usp: "Alcohol-free processing technologies with proven commercial operation",
  metadataTags: ["ENGINEERING", "TECHNOLOGY", "INNOVATION", "RELIABILITY"],
  heroImage: "/images/hero_soltex_panoramic_plant_1790270267701.jpg"
};

export const METRIC_RIBBON = [
  { value: "25+", label: "Years of Industrial Experience", detail: "Specialized process engineering" },
  { value: "10+", label: "Countries Project Experience", detail: "Global execution footprint" },
  { value: "20+", label: "Years of Technology in Operation", detail: "Continuous commercial reliability" },
  { value: "300M+", label: "USD Projects Delivered", detail: "Capital infrastructure value" },
  { value: "Full-Cycle", label: "EPC / EPCM Solutions", detail: "Concept to plant operation" }
];

export const VIDEO_MATERIALS: VideoMaterial[] = [
  {
    id: "tech-deep-processing",
    number: "01",
    category: "INDUSTRIAL TECHNOLOGIES",
    title: "Deep Raw Material Processing — Technologies of the Future",
    description: "Overview of Soltex production solutions, engineering design stages, and installation of high-tech equipment for agro-industrial complexes.",
    duration: "08:45 MIN",
    resolution: "4K HDR",
    tag: "PROCESSING LINES",
    thumbnail: "/images/video_plant_processing_1790267879744.jpg"
  },
  {
    id: "epcm-standards",
    number: "02",
    category: "EPCM STANDARDS & FACILITIES",
    title: "Our Production & EPCM Operational Standards",
    description: "A video tour of completed facilities, demonstration of engineering capacities, and quality control at every stage of project implementation.",
    duration: "11:20 MIN",
    resolution: "4K HDR",
    tag: "EPCM EXECUTION",
    thumbnail: "/images/video_epcm_facility_1790267893198.jpg"
  }
];

/**
 * Homepage "Video Materials" block — the two real Soltex presentation videos.
 * The MP4 files live in /public/videos.
 */
export const COMPANY_VIDEOS: CompanyVideo[] = [
  {
    id: "industrial-technologies",
    number: "01",
    category: "INDUSTRIAL TECHNOLOGIES",
    title: "Deep Raw Material Processing — Technologies of the Future",
    headline: "Deep Raw Material Processing\nTechnologies of the Future",
    description: "Overview of Soltex production solutions, engineering design stages and implementation of high-technology equipment for agro-industrial facilities.",
    src: "/videos/soltex-technologies.mp4",
    thumbnail: "/images/video_plant_processing_1790267879744.jpg"
  },
  {
    id: "epcm-standards",
    number: "02",
    category: "EPCM & PROJECT DELIVERY",
    title: "Our Production & EPCM Operational Standards",
    headline: "Our Production & EPCM\nOperational Standards",
    description: "A video tour of completed facilities, demonstrating engineering capabilities and quality control at every stage of project implementation.",
    src: "/videos/soltex-epcm.mp4",
    thumbnail: "/images/video_epcm_facility_1790267893198.jpg"
  }
];

export const KEY_DIRECTIONS: KeyDirection[] = [
  {
    id: "pectin",
    href: "/technologies/pectin",
    number: "01",
    title: "PECTIN",
    subtitle: "Apple, Citrus, Sugar Beet and other sources",
    description: "Alcohol-free extraction technologies for processing apple pomace, citrus peel and beet pulp into premium pharmaceutical and food-grade pectin.",
    image: "/images/tech_pectin_apples_1790271159655.jpg",
    rawMaterials: ["Apple Pomace", "Citrus Peel", "Sugar Beet Pulp"],
    endProducts: ["High-Methoxyl Pectin", "Low-Methoxyl Pectin", "Amidated Pectin"],
    technologyFeatures: [
      "Acid-free / alcohol-free extraction process",
      "Low wastewater footprint",
      "High gelling degree preservation"
    ]
  },
  {
    id: "soy-protein",
    href: "/technologies/soy-protein",
    number: "02",
    title: "SOY PROTEIN",
    subtitle: "Soy Protein Isolate, Concentrate, Functional Proteins & Fibers",
    description: "Complete soy processing lines for the production of highly purified isolates (≥90%), functional concentrates and dietary soy fibers.",
    image: "/images/tech_soy_beans_1790271178494.jpg",
    rawMaterials: ["Defatted White Flake", "Non-GMO Soybeans", "Soy Meal"],
    endProducts: ["Soy Protein Isolate (≥90%)", "Functional Soy Concentrates", "Dietary Soy Fiber"],
    technologyFeatures: [
      "Ultrafiltration and isoelectric precipitation",
      "Neutral taste and high dispersibility",
      "Energy-efficient spray drying"
    ]
  },
  {
    id: "inulin",
    href: "/technologies/inulin",
    number: "03",
    title: "INULIN",
    subtitle: "Jerusalem Artichoke & Chicory",
    description: "Deep processing technologies for Jerusalem artichoke tubers and chicory roots to produce inulin, fructooligosaccharides and natural prebiotic syrups.",
    image: "/images/tech_inulin_roots_1790271193455.jpg",
    rawMaterials: ["Jerusalem Artichoke Tubers", "Chicory Roots"],
    endProducts: ["High-Purity Inulin Powder", "Fructooligosaccharides (FOS)", "Inulin Syrups"],
    technologyFeatures: [
      "Multi-stage diffusion extraction",
      "Chromatographic fractionation",
      "Gentle low-temperature crystallization"
    ]
  },
  {
    id: "dietary-fibers",
    href: "/technologies/dietary-fibers",
    number: "04",
    title: "DIETARY FIBERS",
    subtitle: "Apple, Citrus, Beet, Soy and more",
    description: "Industrial micronization and extraction systems for producing soluble and insoluble dietary fibers from fruit pomace, grain and vegetable by-products.",
    image: "/images/tech_citrus_oranges_1790271213504.jpg",
    rawMaterials: ["Apple & Citrus Pomace", "Sugar Beet Marc", "Soy & Pea Fibers"],
    endProducts: ["Insoluble Dietary Fiber", "Soluble Pectin Fibers", "Functional Texturizers"],
    technologyFeatures: [
      "Mechanical shear and gentle dehydration",
      "Enhanced water/oil holding capacity",
      "Zero-chemical processing stream"
    ]
  },
  {
    id: "integrated-solutions",
    href: "/technologies",
    number: "05",
    title: "INTEGRATED SOLUTIONS",
    subtitle: "Zero Waste, By-product Valorization & More",
    description: "Closed-loop turnkey processing facilities converting agro-industrial waste and secondary streams into commercial high-value end products.",
    image: "/images/tech_integrated_plant_1790271239031.jpg",
    rawMaterials: ["Press Cake", "Distillery Grains", "Hulls & Processing Residues"],
    endProducts: ["Technical Pellets", "Natural Extracts", "Bio-Fertilizers & Animal Feed"],
    technologyFeatures: [
      "Closed-loop liquid recycling",
      "Zero solid waste discharge architecture",
      "Integrated heat recovery network"
    ]
  },
  {
    id: "functional-ingredients",
    href: "/technologies",
    number: "06",
    title: "FUNCTIONAL INGREDIENTS",
    subtitle: "Custom Development & Blends",
    description: "Custom-tailored extraction and formulation lines for specialized botanicals, active phytocompounds, customized food blends and nutraceutical ingredients.",
    image: "/images/tech_lab_flasks_1790271257443.jpg",
    rawMaterials: ["Botanical Herbs", "Fruit Extracts", "Specialty Plant Extracts"],
    endProducts: ["Standardized Bioactive Extracts", "Targeted Hydrocolloid Systems", "Custom Ingredient Blends"],
    technologyFeatures: [
      "Gentle vacuum and supercritical extraction",
      "Microencapsulation and agglomeration",
      "Modular pilot-to-industrial scale lines"
    ]
  }
];

export const SECTORS_OF_APPLICATION: SectorApplication[] = [
  {
    id: "food-industry",
    number: "01",
    title: "FOOD INDUSTRY",
    description: "Texturizers, gelling agents, structure stabilizers and natural emulsifiers.",
    applications: ["Confectionery & Jellies", "Beverages & Nectars", "Dairy & Desserts"],
    marketFocus: "Texture & Clean-Label Performance"
  },
  {
    id: "pharma-nutra",
    number: "02",
    title: "PHARMACEUTICALS & NUTRACEUTICALS",
    description: "High-purity ingredients, prebiotic fibers and functional compounds.",
    applications: ["Capsule & Tablet Excipients", "Prebiotic Formulations", "Controlled Release Agents"],
    marketFocus: "High Purity & Pharmacopeia Compliance"
  },
  {
    id: "sports-nutrition",
    number: "03",
    title: "SPORTS & FUNCTIONAL NUTRITION",
    description: "High-concentration plant proteins with complete amino acid profiles.",
    applications: ["Protein Powder Blends", "Nutritional Bars", "Ready-to-Drink Shakes"],
    marketFocus: "High Dispersibility & PDCAAS Index"
  },
  {
    id: "food-processing",
    number: "04",
    title: "FOOD PROCESSING",
    description: "Water-binding agents, fat replacers and dough improvers for meat, dairy, bakery and confectionery production.",
    applications: ["Meat Emulsions & Sausages", "Bakery Moisture Retention", "Sauce & Dressing Viscosity"],
    marketFocus: "Functional Yield & Moisture Binding"
  },
  {
    id: "agro-industrial",
    number: "05",
    title: "AGRO-INDUSTRIAL PROCESSING",
    description: "Processing of secondary raw materials to create additional products and diversify production.",
    applications: ["Canning Factory Waste", "Juice Extraction Residues", "Grain Milling Side-streams"],
    marketFocus: "Valorization & By-product Diversification"
  }
];

export const WHY_SOLTEX_ITEMS: WhySoltexReason[] = [
  {
    id: "proprietary-tech",
    number: "01",
    title: "PROPRIETARY TECHNOLOGY EXPERTISE",
    description: "A portfolio of proprietary technologies, patents and R&D expertise for deep processing, separation and extraction.",
    highlight: "Patented extraction without harsh solvents"
  },
  {
    id: "proven-operation",
    number: "02",
    title: "PROVEN COMMERCIAL OPERATION",
    description: "Soltex technologies have been operating in commercial production for more than 20 years.",
    highlight: "20+ years industrial validation"
  },
  {
    id: "capex-opex",
    number: "03",
    title: "CAPEX & OPEX OPTIMIZATION",
    description: "Engineering focused on efficient plant design, capital investment and operating costs.",
    highlight: "Streamlined equipment footprints and heat recovery"
  },
  {
    id: "product-quality",
    number: "04",
    title: "PRODUCT QUALITY",
    description: "Process engineering focused on achieving target product specifications, purity and production yield.",
    highlight: "Target purity and consistent commercial grade"
  },
  {
    id: "post-launch",
    number: "05",
    title: "POST-LAUNCH SUPPORT",
    description: "Technical consulting, spare parts, equipment upgrades and personnel training after commissioning.",
    highlight: "Continuous operational and engineering backing"
  }
];

export const MISSION_COLUMNS = [
  {
    number: "01",
    title: "FROM RAW MATERIAL TO PRODUCT",
    description: "We transform accessible crops and agricultural by-products into high-value ingredients through advanced industrial processing."
  },
  {
    number: "02",
    title: "ALCOHOL-FREE PROCESSING",
    description: "Our technologies use alcohol-free and strong-acid-free processing approaches to reduce the use of harsh chemical reagents."
  },
  {
    number: "03",
    title: "INDUSTRIAL-GRADE PRODUCTION",
    description: "We develop production plants for food, pharmaceutical and functional ingredient markets, with solutions designed around international quality standards."
  }
];

export const EPCM_STAGES: EpcmStage[] = [
  {
    id: "stage-01",
    number: "01",
    title: "FEASIBILITY STUDY",
    description: "Raw material analysis, financial calculations and project feasibility assessment.",
    focus: "Technical & Economic Viability",
    deliverables: ["Raw Material Laboratory Testing", "Mass & Energy Balance Model", "CAPEX / OPEX Financial Model"]
  },
  {
    id: "stage-02",
    number: "02",
    title: "CONCEPT & TECHNICAL ASSIGNMENT",
    description: "Definition of process workflows, material balances and project scope.",
    focus: "Process Architecture",
    deliverables: ["Process Flow Diagrams (PFD)", "Preliminary Plant Master Plan", "Technical Requirements Document"]
  },
  {
    id: "stage-03",
    number: "03",
    title: "ENGINEERING & DESIGN",
    description: "3D BIM modelling and preparation of design, architectural and working documentation.",
    focus: "Comprehensive Engineering",
    deliverables: ["Piping & Instrumentation Diagrams (P&ID)", "3D BIM Digital Twin", "Civil, Structural & Architectural Docs"]
  },
  {
    id: "stage-04",
    number: "04",
    title: "EQUIPMENT SUPPLY",
    description: "Procurement, manufacturing and quality verification of industrial equipment.",
    focus: "Manufacturing & Procurement",
    deliverables: ["Factory Acceptance Tests (FAT)", "Quality Compliance Audits", "International Logistics Management"]
  },
  {
    id: "stage-05",
    number: "05",
    title: "CONSTRUCTION & INSTALLATION",
    description: "Facility construction, mechanical assembly, piping and equipment installation.",
    focus: "On-Site Execution",
    deliverables: ["Civil Works Supervision", "Mechanical Assembly & Piping", "Electrical & Cleanroom Installation"]
  },
  {
    id: "stage-06",
    number: "06",
    title: "COMMISSIONING & COLD RUNS",
    description: "Testing of equipment and industrial automation systems before production launch.",
    focus: "Systems Verification",
    deliverables: ["Dry & Cold Testing Runs", "SCADA & PLC Automation Tuning", "Safety Invariant Checklists"]
  },
  {
    id: "stage-07",
    number: "07",
    title: "REACHING DESIGN CAPACITY",
    description: "Process fine-tuning to achieve contracted production volumes and quality targets.",
    focus: "Capacity Ramp-up",
    deliverables: ["Live Product Hot Runs", "Throughput & Yield Verification", "Official Handover Protocol"]
  },
  {
    id: "stage-08",
    number: "08",
    title: "MAINTENANCE & SUPPORT",
    description: "Technical audits, consumables, training and ongoing technology upgrades.",
    focus: "Operational Lifecycle",
    deliverables: ["Local Operators Certification", "Consumables & Spare Parts Supply", "Remote Diagnostic Monitoring"]
  }
];

export const FEATURED_PROJECT = {
  eyebrow: "FLAGSHIP PROJECT",
  title: "Siberian Wellness Plant",
  meta: "Uzbekistan · 2023–2025",
  description: "EPC/EPCM construction of a hybrid processing facility producing pectin and dietary fibers, with integrated Jerusalem artichoke-to-inulin processing lines.",
  metrics: [
    { value: "500 t", label: "PECTIN", note: "Annual Target Output" },
    { value: "800 t", label: "DIETARY FIBERS", note: "Purified Soluble & Insoluble" }
  ],
  image: "/images/flagship_siberian_wellness_1790267904663.jpg",
  specs: [
    { label: "Delivery Model", value: "Full-Cycle Turnkey EPCM" },
    { label: "Feedstock", value: "Apple Pomace & Jerusalem Artichoke" },
    { label: "Extraction Tech", value: "Alcohol-Free Hydro-Mechanical Line" },
    { label: "Automation Level", value: "Fully Integrated SCADA System" }
  ]
};

export const FINAL_CTA_DATA = {
  eyebrow: "START A PROJECT",
  headline: "Have a processing project in mind?",
  description: "Submit your project requirements for an initial technological assessment.",
  cta: "START YOUR PROJECT",
  backgroundImage: "/images/cta_industrial_backdrop_1790267918185.jpg"
};
