import React, { useState } from 'react';
import { FEATURED_PROJECT, VIDEO_MATERIALS } from '../data/soltexData';
import { ArrowUpRight, Play, CheckCircle, X, Shield, FileText, Calendar, MapPin, Gauge } from 'lucide-react';
import { VideoMaterial } from '../types';

interface FeaturedProjectProps {
  onOpenVideoModal: (video: VideoMaterial) => void;
  onOpenProjectModal: () => void;
}

export const FeaturedProject: React.FC<FeaturedProjectProps> = ({
  onOpenVideoModal,
  onOpenProjectModal
}) => {
  const [caseStudyModalOpen, setCaseStudyModalOpen] = useState(false);

  return (
    <section id="projects" className="py-24 bg-[#F4F4EC] border-b border-[#16211B]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#0E482C]" />
            <span className="font-tech text-xs font-semibold tracking-widest text-[#0E482C] uppercase">
              {FEATURED_PROJECT.eyebrow}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#16211B]/10 pb-6">
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-[#111814] tracking-tight">
                {FEATURED_PROJECT.title}
              </h2>
              <div className="flex items-center gap-3 mt-2 text-xs font-tech text-[#55695E]">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#0E482C]" />
                  <span>Uzbekistan</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#B89758]" />
                  <span>2023–2025</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setCaseStudyModalOpen(true)}
              className="mt-4 md:mt-0 inline-flex items-center gap-2 text-xs font-tech font-bold uppercase tracking-wider text-[#0E482C] hover:text-[#0A3620]"
            >
              <span>VIEW DETAILED CASE STUDY</span>
              <ArrowUpRight className="w-4 h-4 text-[#B89758]" />
            </button>
          </div>
        </div>

        {/* Case Study Card Showcase */}
        <div className="bg-[#FFFFFF] border border-[#16211B]/15 overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Large Industrial Image + Video Play Button (7 cols) */}
            <div className="lg:col-span-7 relative bg-[#111814] aspect-[16/10] lg:aspect-auto overflow-hidden group">
              <img
                src={FEATURED_PROJECT.image}
                alt="Siberian Wellness Plant in Uzbekistan"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-700 opacity-90"
              />

              {/* Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* Framing Hairlines */}
              <div className="absolute inset-4 border border-white/20 pointer-events-none" />

              {/* Status Badge */}
              <div className="absolute top-6 left-6 z-10 bg-[#0E482C]/90 px-3 py-1 text-[11px] font-tech text-[#D4B982] tracking-widest uppercase border border-white/10">
                ACTIVE EPCM COMMISSIONING
              </div>

              {/* Play Video Trigger */}
              <button
                onClick={() => onOpenVideoModal(VIDEO_MATERIALS[0])}
                className="absolute inset-0 flex items-center justify-center z-20 group/play focus-visible:outline-none"
                aria-label="Play facility video"
              >
                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-white group-hover/play:scale-110 group-hover/play:bg-[#0E482C] group-hover/play:border-[#D4B982] transition-all duration-300 shadow-2xl">
                  <Play className="w-6 h-6 ml-0.5 fill-white text-white group-hover/play:text-[#D4B982]" />
                </div>
              </button>

              {/* Bottom Caption */}
              <div className="absolute bottom-6 inset-x-6 z-10 flex items-center justify-between text-xs font-tech text-white/80 border-t border-white/20 pt-2">
                <span>HYBRID PECTIN & INULIN COMPLEX</span>
                <span className="text-[#D4B982]">UZBEKISTAN FACILITY</span>
              </div>
            </div>

            {/* Right: Editorial Case Study Brief & Key Metrics (5 cols) */}
            <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between bg-white">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-tech text-xs text-[#0E482C] font-bold">
                    COMMISSIONED FACILITY
                  </span>
                  <span className="text-[#A4B3A9]">·</span>
                  <span className="font-tech text-xs text-[#6B7D71]">
                    {FEATURED_PROJECT.meta}
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-[#111814] mb-4 tracking-tight">
                  {FEATURED_PROJECT.title}
                </h3>

                <p className="text-sm text-[#4E5E55] leading-relaxed mb-8 font-normal">
                  {FEATURED_PROJECT.description}
                </p>

                {/* Verified Output Metrics */}
                <div className="grid grid-cols-2 gap-4 py-6 border-y border-[#16211B]/10 mb-8 bg-[#FAF9F5] px-4">
                  {FEATURED_PROJECT.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="font-tech text-3xl font-extrabold text-[#0E482C] tracking-tight tabular-nums">
                        {m.value}
                      </div>
                      <div className="font-tech text-xs font-bold text-[#111814] uppercase tracking-wider mt-1">
                        {m.label}
                      </div>
                      <div className="text-[11px] text-[#6B7D71] mt-0.5">
                        {m.note}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Specs List */}
                <div className="space-y-2 mb-8 text-xs font-tech">
                  {FEATURED_PROJECT.specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between border-b border-[#EAEAE2] pb-1.5">
                      <span className="text-[#65776C]">{spec.label.toUpperCase()}:</span>
                      <span className="text-[#121815] font-semibold text-right">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-[#16211B]/10">
                <button
                  onClick={() => setCaseStudyModalOpen(true)}
                  className="px-6 py-3 bg-[#0E482C] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2"
                >
                  <span>VIEW CASE STUDY</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#D4B982]" />
                </button>
                <button
                  onClick={onOpenProjectModal}
                  className="px-5 py-3 border border-[#0E482C]/30 text-[#0E482C] text-xs font-bold uppercase tracking-wider hover:bg-[#0E482C]/5 transition-colors"
                >
                  Inquire Similar Plant
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Case Study Modal Detail View */}
      {caseStudyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#07130D]/85 backdrop-blur-sm"
            onClick={() => setCaseStudyModalOpen(false)}
          />
          <div className="relative w-full max-w-3xl bg-white border border-[#16211B]/20 shadow-2xl z-10 overflow-hidden my-6">
            <div className="bg-[#0E482C] px-6 py-4 flex items-center justify-between text-white border-b border-[#0A3620]">
              <div className="flex items-center gap-2">
                <span className="font-tech text-xs tracking-widest text-[#D4B982] uppercase">
                  CASE STUDY ARCHIVE
                </span>
                <span className="text-white/40">|</span>
                <span className="text-xs font-semibold">{FEATURED_PROJECT.title}</span>
              </div>
              <button
                onClick={() => setCaseStudyModalOpen(false)}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#E7E7DE] pb-4">
                <div>
                  <span className="font-tech text-xs text-[#B89758] block mb-1">
                    {FEATURED_PROJECT.meta}
                  </span>
                  <h3 className="text-2xl font-bold text-[#121815]">
                    {FEATURED_PROJECT.title}
                  </h3>
                </div>
                <div className="text-right font-tech text-xs text-[#5D6F64]">
                  <div>DELIVERY MODEL:</div>
                  <div className="font-bold text-[#0E482C]">TURNKEY EPC / EPCM</div>
                </div>
              </div>

              <p className="text-sm text-[#3E5045] leading-relaxed">
                {FEATURED_PROJECT.description} This facility was architected and built to process locally sourced apple and citrus raw materials alongside Jerusalem artichoke crops, creating a high-margin integrated valorization hub.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#F8F8F4] border border-[#E3E3D9] font-tech text-xs">
                <div>
                  <span className="text-[#6D8074] block">ANNUAL PECTIN</span>
                  <span className="text-xl font-bold text-[#0E482C]">500 t</span>
                </div>
                <div>
                  <span className="text-[#6D8074] block">DIETARY FIBERS</span>
                  <span className="text-xl font-bold text-[#0E482C]">800 t</span>
                </div>
                <div>
                  <span className="text-[#6D8074] block">EXTRACTION TECH</span>
                  <span className="font-semibold text-[#121815]">Alcohol-Free</span>
                </div>
                <div>
                  <span className="text-[#6D8074] block">AUTOMATION</span>
                  <span className="font-semibold text-[#121815]">SCADA 100%</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-tech text-xs uppercase tracking-wider text-[#0E482C] font-bold">
                  Soltex Engineering Scope Delivered
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#2A3B31]">
                  {[
                    'Complete Raw Material Feasibility & Balance Models',
                    '3D BIM Plant Digital Twin & Mechanical Layouts',
                    'Equipment Fabrication, Logistics & On-site Erection',
                    'Cold Runs, Automated SCADA Verification & Commissioning',
                    'Personnel Training & Quality Assurance Handover',
                    'Post-launch Capacity Optimization & Warranty Audits'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-[#FAF9F5] border border-[#EAEAE2]">
                      <CheckCircle className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E7E7DE] flex items-center justify-between">
                <button
                  onClick={() => setCaseStudyModalOpen(false)}
                  className="text-xs text-[#5D6F64] hover:text-[#121815]"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setCaseStudyModalOpen(false);
                    onOpenProjectModal();
                  }}
                  className="px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#0A3620]"
                >
                  Discuss Similar Processing Facility
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
