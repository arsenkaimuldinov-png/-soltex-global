import React from 'react';
import { WHY_SOLTEX_ITEMS } from '../data/soltexData';
import { CheckCircle, ShieldCheck, ArrowRight } from 'lucide-react';

interface WhySoltexProps {
  onOpenProjectModal: () => void;
}

export const WhySoltex: React.FC<WhySoltexProps> = ({ onOpenProjectModal }) => {
  return (
    <section id="why-soltex" className="py-24 bg-[#FBFBF8] border-b border-[#16211B]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#0E482C]" />
            <span className="font-tech text-xs font-semibold tracking-widest text-[#0E482C] uppercase">
              WHY SOLTEX
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#111814] tracking-tight leading-[1.12]">
                Technology built for industrial scale
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pt-2">
              <p className="text-base text-[#45574D] leading-relaxed">
                From proprietary technologies to full-cycle project execution, Soltex combines process expertise, engineering and operational support in one delivery model.
              </p>
            </div>
          </div>
        </div>

        {/* Clean Indexed Vertical List (Not 5 cards) */}
        <div className="border-t border-[#16211B]/15 divide-y divide-[#16211B]/15">
          {WHY_SOLTEX_ITEMS.map((item) => (
            <div
              key={item.id}
              className="py-8 sm:py-10 flex flex-col md:flex-row md:items-start justify-between gap-6 px-2 sm:px-4 hover:bg-[#F3F3EC] transition-colors group"
            >
              {/* Left Column: Big Index Number + Title */}
              <div className="md:w-5/12 flex items-baseline gap-6 sm:gap-10">
                <span className="font-tech text-3xl sm:text-4xl font-extrabold text-[#0E482C] tracking-tighter tabular-nums shrink-0">
                  {item.number}
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#111814] tracking-tight group-hover:text-[#0E482C] transition-colors">
                    {item.title}
                  </h3>
                  <span className="inline-block mt-1 font-tech text-xs text-[#B89758] font-medium tracking-wide">
                    {item.highlight}
                  </span>
                </div>
              </div>

              {/* Right Column: Precise Description */}
              <div className="md:w-6/12 pl-12 sm:pl-16 md:pl-0">
                <p className="text-sm sm:text-base text-[#3E5045] leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Assurance Note */}
        <div className="mt-12 pt-8 border-t border-[#16211B]/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-[#45574D]">
            <ShieldCheck className="w-5 h-5 text-[#0E482C] shrink-0" />
            <span>Over two decades of commercial plant operation and international engineering delivery.</span>
          </div>
          <button
            onClick={onOpenProjectModal}
            className="inline-flex items-center gap-2 text-xs font-tech font-bold uppercase tracking-wider text-[#0E482C] hover:text-[#0A3620] group"
          >
            <span>Consult with Soltex Engineers</span>
            <ArrowRight className="w-4 h-4 text-[#B89758] group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
};
