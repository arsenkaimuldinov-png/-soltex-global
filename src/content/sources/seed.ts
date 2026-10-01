/**
 * Seed content source: the approved site content as JSON files in src/content/seed/.
 * This is the single source of truth until the custom admin exists; the admin's database
 * will be initialised from these files (see docs/custom-admin-architecture.md).
 */
import type { ContentSource } from '../source';
import type {
  ContentStore,
  EpcmStageRecord,
  GlobalSettingsRecord,
  MediaRecord,
  PageRecord,
  PatentRecord,
  ProductRecord,
  ProjectRecord,
  RedirectRecord,
  TechnologyRecord,
  VideoRecord,
} from '../types';
import pages from '../seed/pages.json';
import projects from '../seed/projects.json';
import technologies from '../seed/technologies.json';
import products from '../seed/products.json';
import epcmStages from '../seed/epcm-stages.json';
import patents from '../seed/patents.json';
import videos from '../seed/videos.json';
import media from '../seed/media.json';
import settings from '../seed/settings.json';
import redirects from '../seed/redirects.json';

export const seedContentSource: ContentSource = {
  name: 'seed',
  async loadStore(): Promise<ContentStore> {
    return {
      pages: pages as unknown as PageRecord[],
      projects: projects as unknown as ProjectRecord[],
      technologies: technologies as unknown as TechnologyRecord[],
      products: products as unknown as ProductRecord[],
      epcmStages: epcmStages as unknown as EpcmStageRecord[],
      patents: patents as unknown as PatentRecord[],
      videos: videos as unknown as VideoRecord[],
      media: media as unknown as MediaRecord[],
      settings: settings as unknown as GlobalSettingsRecord,
      redirects: redirects as unknown as RedirectRecord[],
    };
  },
};
