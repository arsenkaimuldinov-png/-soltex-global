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

/** Real Soltex presentation video shown in the homepage "Video Materials" block. */
export interface CompanyVideo {
  id: string;
  number: string;
  category: string;
  /** Full one-line title (used for accessible names). */
  title: string;
  /** Display headline; "\n" marks the intended line break. */
  headline: string;
  description: string;
  /** Local MP4 in /public/videos, when the file has been imported. */
  src?: string;
  /** External source (Google Drive), used until a local MP4 is available. */
  externalUrl: string;
  thumbnail: string;
}

export interface KeyDirection {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  description: string;
  image?: string;
  /** Page the card links to (technology dossier, or the technologies overview). */
  href: string;
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
