export interface VideoMaterial {
  id: string;
  number: string;
  category: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  resolution: string;
  tag: string;
}

export interface KeyDirection {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  description: string;
  image?: string;
  rawMaterials: string[];
  endProducts: string[];
  technologyFeatures: string[];
}

export interface SectorApplication {
  id: string;
  number: string;
  title: string;
  description: string;
  applications: string[];
  marketFocus: string;
}

export interface WhySoltexReason {
  id: string;
  number: string;
  title: string;
  description: string;
  highlight: string;
}

export interface EpcmStage {
  id: string;
  number: string;
  title: string;
  description: string;
  deliverables: string[];
  focus: string;
}

export interface ProjectInquiryData {
  fullName: string;
  email: string;
  company: string;
  country: string;
  rawMaterial: string;
  projectStage: string;
  estimatedVolume: string;
  additionalDetails: string;
}
