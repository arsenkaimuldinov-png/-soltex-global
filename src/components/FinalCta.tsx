import React from 'react';
import { FINAL_CTA_DATA } from '../data/soltexData';
import { ArrowRight, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';

interface FinalCtaProps {
  onOpenProjectModal: () => void;
}

export const FinalCta: React.FC<FinalCtaProps> = ({ onOpenProjectModal }) => {
  return (
    <section id="contact" className="relative py-28 bg-[#09150E] text-white overflow-hidden border-t border-[#132A1C]">
      {/* High-impact industrial atmospheric background */}
      <div className="absolute inset-0 z-0">
        <img
          src={FINAL_CTA_DATA.backgroundImage}
          alt="Soltex Industrial Processing Infrastructure"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07130D] via-[#07130D]/90 to-[#0A1F14]/80" />
      </div>

      {/* Blueprint grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#B89758 1px, transparent 1px), linear-gradient(90deg, #B89758 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 bg-[#B89758]" />
            <span className="font-tech text-xs font-semibold tracking-widest text-[#D4B982] uppercase">
              {FINAL_CTA_DATA.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.08] mb-6">
            {FINAL_CTA_DATA.headline}
          </h2>

          {/* Description */}
          <p className="text-base sm:text-lg text-white/75 leading-relaxed mb-10 max-w-xl font-normal">
            {FINAL_CTA_DATA.description}
          </p>

          {/* Primary Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12">
            <button
              onClick={onOpenProjectModal}
              className="inline-flex items-center justify-center gap-3 px-9 py-4.5 bg-[#0E482C] text-white text-xs font-bold tracking-widest uppercase hover:bg-[#0A3620] border border-[#D4B982]/30 transition-all shadow-xl group"
            >
              <span>{FINAL_CTA_DATA.cta}</span>
              <ArrowRight className="w-4 h-4 text-[#D4B982] group-hover:translate-x-1.5 transition-transform" />
            </button>

            <a
              href="mailto:info@soltexglobal.co"
              className="inline-flex items-center justify-center gap-2 px-6 py-4.5 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold tracking-wider uppercase border border-white/20 transition-colors font-tech"
            >
              <Mail className="w-4 h-4 text-[#D4B982]" />
              <span>info@soltexglobal.co</span>
            </a>
          </div>

          {/* Technical contact coordinates ribbon */}
          <div className="pt-8 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-6 font-tech text-xs text-white/70">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#D4B982] shrink-0" />
              <span>Dubai, United Arab Emirates</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#D4B982] shrink-0" />
              <span>Full NDA & Process IP Protection</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0 animate-pulse" />
              <span>Engineering Group Active</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
