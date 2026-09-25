import React from 'react';
import { MISSION_COLUMNS } from '../data/soltexData';

export const MissionDark: React.FC = () => {
  return (
    <section id="approach" className="py-28 bg-[#091811] text-white relative overflow-hidden border-y border-[#183627]">
      {/* Technical blueprint grid watermark background */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#B89758 1px, transparent 1px), linear-gradient(90deg, #B89758 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Subtle atmospheric gradient radial glow */}
      <div className="absolute -top-40 right-1/4 w-96 h-96 bg-[#0E482C]/30 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Eyebrow */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 bg-[#B89758]" />
          <span className="font-tech text-xs font-semibold tracking-widest text-[#D4B982] uppercase">
            MISSION / TECHNOLOGICAL APPROACH
          </span>
        </div>

        {/* Large Editorial Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold text-white tracking-tight leading-[1.1] mb-16 max-w-3xl">
          Turning natural raw materials into high-value ingredients
        </h2>

        {/* Three Distinct Large Columns with Thin Dividers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-white/15 divide-y lg:divide-y-0 lg:divide-x divide-white/15">
          {MISSION_COLUMNS.map((col, index) => (
            <div
              key={col.number}
              className={`py-10 ${
                index === 0 ? 'lg:pr-10' : index === 1 ? 'lg:px-10' : 'lg:pl-10'
              } flex flex-col justify-between group`}
            >
              <div>
                {/* Numbered Indicator */}
                <div className="flex items-center justify-between mb-8">
                  <span className="font-tech text-4xl sm:text-5xl font-extrabold text-[#D4B982] tracking-tighter tabular-nums">
                    {col.number}
                  </span>
                  <span className="font-tech text-[10px] tracking-widest uppercase text-white/40 border border-white/15 px-2 py-0.5">
                    PRINCIPLE {col.number}
                  </span>
                </div>

                {/* Column Headline */}
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4 group-hover:text-[#D4B982] transition-colors leading-snug">
                  {col.title}
                </h3>

                {/* Statement Body */}
                <p className="text-sm sm:text-base text-white/70 leading-relaxed font-normal">
                  {col.description}
                </p>
              </div>

              {/* Technical Rule Bottom */}
              <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between font-tech text-[11px] text-white/50">
                <span>SOLTEX STANDARD</span>
                <span className="text-[#D4B982]">STAGE {col.number}/03</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
