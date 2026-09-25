import React from 'react';
import { Play, ArrowRight, FolderGit2, Gauge, Layers, Calendar } from 'lucide-react';
import { VideoMaterial } from '../types';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';

interface FeaturedProjectsBlockProps {
  onOpenVideoModal?: (video: VideoMaterial) => void;
  onOpenProjectModal?: (projectName?: string) => void;
}

interface ProjectCardData {
  id: string;
  title: string;
  location: string;
  capacity: string;
  model: string;
  year: string;
  image: string;
  video: VideoMaterial;
}

const FEATURED_PROJECTS: ProjectCardData[] = [
  {
    id: 'pectin-uzbekistan',
    title: 'PECTIN PRODUCTION PLANT',
    location: 'UZBEKISTAN',
    capacity: '500 MT / DAY',
    model: 'EPC / EPCM',
    year: '2024',
    image: '/images/project_pectin_uzbekistan_1790271708882.jpg',
    video: {
      id: 'pectin-uzb-vid',
      number: '01',
      category: 'TURNKEY EXTRACTION PLANT',
      title: 'Pectin Production Plant — Uzbekistan Facility Tour',
      description: 'Comprehensive engineering walkthrough of the 500 MT/day turnkey pectin extraction facility in Uzbekistan, from raw pomace intake to high-purity crystallization.',
      duration: '08:45 MIN',
      thumbnail: '/images/project_pectin_uzbekistan_1790271708882.jpg',
      resolution: '4K HDR',
      tag: 'PECTIN EXTRACTION'
    }
  },
  {
    id: 'soy-israel',
    title: 'SOY PROTEIN ISOLATE PLANT',
    location: 'ISRAEL',
    capacity: '700 MT / DAY',
    model: 'EPC / EPCM',
    year: '2023',
    image: '/images/project_soy_israel_1790271724797.jpg',
    video: {
      id: 'soy-isr-vid',
      number: '02',
      category: 'PROTEIN ISOLATE PROCESSING',
      title: 'Soy Protein Isolate Plant — Israel Execution Case',
      description: 'High-purity soy protein isolate (≥90%) industrial facility in Israel featuring automated ultrafiltration lines, spray drying towers, and continuous CIP loops.',
      duration: '11:20 MIN',
      thumbnail: '/images/project_soy_israel_1790271724797.jpg',
      resolution: '4K HDR',
      tag: 'SOY PROTEIN'
    }
  }
];

export const VideoBlock: React.FC<FeaturedProjectsBlockProps> = ({
  onOpenVideoModal,
  onOpenProjectModal
}) => {
  const { t } = useI18n();
  const handlePlayVideo = (video: VideoMaterial, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpenVideoModal) {
      onOpenVideoModal(video);
    }
  };

  const handleCardClick = (project: ProjectCardData) => {
    if (onOpenVideoModal) {
      onOpenVideoModal(project.video);
    } else if (onOpenProjectModal) {
      onOpenProjectModal(`${t(project.title)} (${t(project.location)})`);
    }
  };

  return (
    <section id="projects" className="py-14 sm:py-18 lg:py-20 bg-[#FBFBF8] border-b border-[#16211B]/10">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header: Centered with subtle gold accent line matching Screenshot 2 */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#111814] tracking-wider uppercase font-tech">
            {t("FEATURED PROJECTS")}
          </h2>
          <div className="w-12 h-[2px] bg-[#B89758] mx-auto mt-2.5" aria-hidden="true" />
        </div>

        {/* 3-Card Layout matching Screenshot 2: 5 cols + 5 cols + 2 cols on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 lg:gap-5 items-stretch">
          
          {/* Card 1 & Card 2: Wide Project Cards with Video Overlay */}
          {FEATURED_PROJECTS.map((project) => (
            <div
              key={project.id}
              onClick={() => handleCardClick(project)}
              className="lg:col-span-5 relative group overflow-hidden bg-[#111814] border border-[#16211B]/15 shadow-xs cursor-pointer flex flex-col justify-end min-h-[360px] sm:min-h-[380px] lg:min-h-[400px]"
            >
              {/* Background Plant Photography */}
              <img
                src={project.image}
                alt={`${t(project.title)} - ${t(project.location)}`}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-104 transition-transform duration-700 ease-out opacity-85"
              />

              {/* Multi-stage Dark Gradient Overlay for optimal legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10 pointer-events-none" />

              {/* Subtle architectural hairline framing */}
              <div className="absolute inset-3 border border-white/15 pointer-events-none group-hover:border-white/30 transition-colors" />

              {/* Center Play Button Overlay */}
              <button
                type="button"
                onClick={(e) => handlePlayVideo(project.video, e)}
                className="absolute inset-0 flex items-center justify-center z-20 focus-visible:outline-none"
                aria-label={t("Watch video tour of {title}", { title: t(project.title) })}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/60 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#0E482C] group-hover:border-[#D4B982] transition-all duration-300 shadow-xl">
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-white text-white group-hover:text-[#D4B982]" />
                </div>
              </button>

              {/* Bottom Information Overlay */}
              <div className="relative z-10 p-5 sm:p-6 lg:p-7">
                <h3 className="font-tech text-base sm:text-lg lg:text-[19px] font-extrabold text-white tracking-wide uppercase leading-tight mb-1">
                  {t(project.title)}
                </h3>
                <p className="font-tech text-xs sm:text-sm font-bold text-[#D4B982] tracking-wider uppercase mb-3.5">
                  {t(project.location)}
                </p>

                {/* Metadata Line with Icons */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] sm:text-[11px] font-tech text-white/85 uppercase tracking-wider mb-4 border-t border-white/15 pt-3">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-[#D4B982]" />
                    <span>{t(project.capacity)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#D4B982]" />
                    <span>{t(project.model)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#D4B982]" />
                    <span>{t(project.year)}</span>
                  </span>
                </div>

                {/* Action Link: View Case Study */}
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-tech font-bold text-white uppercase tracking-wider group-hover:text-[#D4B982] transition-colors">
                  <span>{t("VIEW CASE STUDY")}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}

          {/* Card 3: Solid Dark Soltex Green Action Card */}
          <div
            onClick={() => {
              if (onOpenProjectModal) {
                onOpenProjectModal('All Projects Portfolio Inquiry');
              }
            }}
            className="md:col-span-2 lg:col-span-2 bg-[#0E482C] text-white p-6 sm:p-7 lg:p-8 flex flex-col justify-between border border-[#0E482C] group hover:bg-[#0A3620] transition-colors cursor-pointer min-h-[280px] sm:min-h-[380px] lg:min-h-[400px] shadow-xs"
          >
            <div>
              {/* Document / Projects Folder Icon */}
              <div className="w-12 h-12 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center text-[#D4B982] mb-6 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-6 h-6" />
              </div>

              {/* Card Title */}
              <h3 className="font-tech text-base sm:text-lg font-extrabold text-white tracking-wider uppercase mb-3 leading-snug">
                {withLineBreaks(t("VIEW ALL\nPROJECTS"))}
              </h3>

              {/* Card Subtitle */}
              <p className="text-xs sm:text-[12.5px] text-white/80 leading-relaxed font-normal">
                {t("Discover more projects and engineering success stories.")}
              </p>
            </div>

            {/* Bottom Action Link */}
            <div className="pt-6 border-t border-white/20 flex items-center gap-2 text-[10.5px] sm:text-xs font-tech font-bold text-white uppercase tracking-wider group-hover:text-[#D4B982] transition-colors">
              <span>{t("ALL PROJECTS")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
