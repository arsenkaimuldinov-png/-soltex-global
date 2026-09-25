import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HERO_DATA } from '../data/soltexData';

interface HeroProps {
  onOpenProjectModal: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenProjectModal }) => {
  return (
    <section className="relative pt-24 sm:pt-28 lg:pt-32 pb-12 sm:pb-16 lg:pb-20 bg-[#FBFBF8] overflow-hidden border-b border-[#16211B]/10 min-h-[580px] lg:min-h-[660px] flex items-center">
      {/* Desktop Panoramic Image Container: Positioned on the right ~54% */}
      <div className="hidden lg:block absolute top-0 right-0 bottom-0 w-[56%] xl:w-[54%] 2xl:w-[52%] overflow-hidden pointer-events-none select-none z-0">
        <div className="relative w-full h-full">
          {/* Undistorted High-Resolution Rectangular Industrial Plant Image */}
          <img
            src={HERO_DATA.heroImage}
            alt="Soltex Global Turnkey Industrial Processing Plant Facility"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-[right_center]"
          />

          {/* Smooth feathered horizontal transition overlay over ~200px: #FBFBF8 -> transparent */}
          <div
            className="absolute top-0 bottom-0 left-0 w-[200px] pointer-events-none"
            style={{
              background:
                'linear-gradient(to right, #FBFBF8 0%, rgba(251, 251, 248, 0.94) 30px, rgba(251, 251, 248, 0.75) 80px, rgba(251, 251, 248, 0.40) 130px, rgba(251, 251, 248, 0.12) 170px, transparent 200px)'
            }}
          />
        </div>
      </div>

      {/* Hero Visual & Content Area */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Editorial Typography & Content (50% on desktop) */}
          <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center max-w-[620px]">
            {/* Eyebrow with Thin Gold Horizontal Line */}
            <div className="flex items-center gap-3 mb-5">
              <span className="w-8 sm:w-10 h-[2px] bg-[#B89758] shrink-0" aria-hidden="true" />
              <span className="font-tech text-xs font-semibold tracking-widest text-[#55695E] uppercase">
                {HERO_DATA.eyebrow}
              </span>
            </div>

            {/* Main Headline: Large Bold Uppercase */}
            <h1 className="text-3xl sm:text-5xl lg:text-[46px] xl:text-[52px] font-extrabold tracking-tight leading-[1.06] mb-5">
              <span className="block text-[#0E482C]">ENGINEERING</span>
              <span className="block text-[#111814]">ADVANCED PLANT</span>
              <span className="block text-[#111814]">PROCESSING FACILITIES</span>
            </h1>

            {/* Description Paragraph */}
            <p className="text-sm sm:text-base text-[#46574D] leading-relaxed mb-6 max-w-[600px] font-normal">
              {HERO_DATA.description}
            </p>

            {/* Capability Metadata Line with Vertical Pipes */}
            <div className="flex flex-wrap items-center text-[10.5px] sm:text-[11px] font-tech text-[#5A6D62] tracking-widest uppercase mb-8 select-none">
              <span className="text-[#A4B3A9] mr-2.5">|</span>
              {HERO_DATA.metadataTags.map((tag) => (
                <React.Fragment key={tag}>
                  <span className="hover:text-[#0E482C] transition-colors">{tag}</span>
                  <span className="text-[#A4B3A9] mx-2.5">|</span>
                </React.Fragment>
              ))}
            </div>

            {/* Rectangular Action Buttons: Left Dark Green, Right Clean White */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 mb-6">
              <button
                onClick={onOpenProjectModal}
                className="inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-[#0E482C] text-white text-xs font-bold tracking-wider uppercase hover:bg-[#0A3620] transition-colors shadow-xs group cursor-pointer border border-[#0E482C] rounded-none"
              >
                <span>START YOUR PROJECT</span>
                <ArrowRight className="w-4 h-4 text-[#D4B982] group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#technologies"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-white border border-[#16211B]/20 text-[#111814] text-xs font-bold tracking-wider uppercase hover:bg-[#FAF9F5] hover:border-[#16211B]/40 transition-colors shadow-2xs rounded-none"
              >
                <span>EXPLORE TECHNOLOGIES</span>
              </a>
            </div>

            {/* USP Note with Subtle Gold Dot */}
            <div className="flex items-center gap-2.5 text-xs text-[#526458]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B89758] shrink-0" aria-hidden="true" />
              <span>{HERO_DATA.usp}</span>
            </div>
          </div>

          {/* Mobile / Tablet Image Representation (Stack cleanly on smaller viewports) */}
          <div className="lg:hidden w-full aspect-[16/10] overflow-hidden border border-[#16211B]/10 mt-6 shadow-sm">
            <img
              src={HERO_DATA.heroImage}
              alt="Soltex Global Turnkey Industrial Processing Plant Facility"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[right_center]"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
