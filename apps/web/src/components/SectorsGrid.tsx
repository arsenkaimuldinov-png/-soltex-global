import React from 'react';
import { SECTORS_OF_APPLICATION } from '../data/soltexData';
import { ArrowUpRight } from 'lucide-react';

interface SectorsGridProps {
  onSelectSector?: (sector: string) => void;
}

export const SectorsGrid: React.FC<SectorsGridProps> = ({ onSelectSector }) => {
  return (
    <section id="sectors" className="py-24 bg-[#F4F4EC] border-b border-[#16211B]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#0E482C]" />
            <span className="font-tech text-xs font-semibold tracking-widest text-[#0E482C] uppercase">
              SECTORS & APPLICATIONS
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#111814] tracking-tight leading-[1.12]">
                Processing technologies across key industries
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pt-2">
              <p className="text-base text-[#45574D] leading-relaxed">
                Soltex technologies are applied across food, pharmaceutical, nutritional and agro-industrial production.
              </p>
            </div>
          </div>
        </div>

        {/* Architectural Editorial Grid with Numbered Cells */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-[#16211B]/15 bg-white">
          {SECTORS_OF_APPLICATION.map((sector, index) => {
            // Give cell 01 or 04 an architectural emphasis if needed
            const isWide = index === 3 || index === 4;
            return (
              <div
                key={sector.id}
                className={`p-8 sm:p-10 border-r border-b border-[#16211B]/15 flex flex-col justify-between group hover:bg-[#FAF9F5] transition-colors ${
                  isWide && index === 3 ? 'lg:col-span-1' : ''
                } ${isWide && index === 4 ? 'lg:col-span-2' : ''}`}
              >
                <div>
                  {/* Top Number + Market Focus */}
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#16211B]/10">
                    <span className="font-tech text-3xl font-extrabold text-[#0E482C] tracking-tight">
                      {sector.number}
                    </span>
                    <span className="font-tech text-[11px] uppercase tracking-widest text-[#B89758] font-semibold">
                      {sector.marketFocus}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-[#111814] tracking-tight mb-4 group-hover:text-[#0E482C] transition-colors">
                    {sector.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#4E5E55] leading-relaxed mb-6 font-normal">
                    {sector.description}
                  </p>
                </div>

                {/* Sub-applications list */}
                <div className="pt-4 border-t border-[#16211B]/10">
                  <span className="font-tech text-[10px] text-[#7A8C81] uppercase tracking-wider block mb-2 font-medium">
                    KEY OUTPUTS:
                  </span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#2A3B31]">
                    {sector.applications.map((app, appIdx) => (
                      <span key={app} className="inline-flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-[#B89758] rounded-full" />
                        <span>{app}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
