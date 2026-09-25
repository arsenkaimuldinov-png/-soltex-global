import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Factory, Cpu, Layers, HardHat, FileSpreadsheet, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { EPCM_SERVICES_DETAILED } from '../data/pagesData';

// Visual image mapping for each major EPCM stage
const EPCM_STAGE_IMAGES: Record<string, { src: string; caption: string }> = {
  '01': {
    src: '/images/tech_lab_flasks_1790271257443.jpg',
    caption: 'Feedstock Laboratory Profiling & Extraction Assay'
  },
  '02': {
    src: '/images/tech_citrus_oranges_1790271213504.jpg',
    caption: 'Raw Biomass Mass Balance & Financial Modeling'
  },
  '03': {
    src: '/images/tech_integrated_plant_1790271239031.jpg',
    caption: '3D BIM Digital Twin & Process Instrumentation Diagram'
  },
  '04': {
    src: '/images/video_epcm_facility_1790267893198.jpg',
    caption: 'Proprietary Stainless Reactor Fabrication & FAT Inspection'
  },
  '05': {
    src: '/images/video_plant_processing_1790267879744.jpg',
    caption: 'Hygienic Cleanroom Piping Installation & Orbital Welds'
  },
  '06': {
    src: '/images/hero_plant_pristine_1790269454820.jpg',
    caption: 'Hydrostatic Calibration & Automated SCADA Tuning'
  },
  '07': {
    src: '/images/flagship_siberian_wellness_1790267904663.jpg',
    caption: 'Live Feedstock Commercial Ramp-up & Operator Training'
  },
  '08': {
    src: '/images/hero_industrial_plant_1790267866540.jpg',
    caption: 'Continuous 72-Hour Run at 100% Target Capacity'
  },
  '09': {
    src: '/images/project_pectin_uzbekistan_1790271708882.jpg',
    caption: 'International Certification: ISO 22000 & HACCP Audit'
  },
  '10': {
    src: '/images/project_soy_israel_1790271724797.jpg',
    caption: 'Long-Term Technological Upgrades & Diagnostic Support'
  }
};

interface EpcmPageProps {
  onOpenProjectModal?: (topic?: string) => void;
}

export const EpcmPage: React.FC<EpcmPageProps> = ({ onOpenProjectModal }) => {
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        badgeNumber="05"
        badgeLabel="TURNKEY DELIVERY"
        title="Full-Cycle EPCM Industrial Services"
        subtitle="From Laboratory Concept to Continuous Multi-Ton Commercial Production"
        description="Soltex Global delivers complex deep agro-processing installations under unified Engineering, Procurement, Construction Management (EPCM) and turnkey EPC models. We assume total technical responsibility from biomass testing to operational yield guarantees."
        breadcrumbs={[
          { label: 'EPCM Services' }
        ]}
        metaTags={[
          { label: 'Contract Models', value: 'Turnkey EPC / EPCM / PMC' },
          { label: 'Quality Standards', value: 'ISO 9001 · HACCP · GMP' },
          { label: 'Operational Guarantee', value: 'Output Purity & Volume' },
          { label: 'Lifecycle Responsibility', value: 'End-to-End Delivery' }
        ]}
        primaryAction={{
          label: 'Inquire for Plant Delivery',
          onClick: () => onOpenProjectModal?.('Turnkey EPCM Project Inquiry')
        }}
      />

      {/* Intro Context with Architectural Photo */}
      <section className="py-16 lg:py-20 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <ScrollReveal>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  01 · THE EPCM PHILOSOPHY
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  Single-Point Responsibility Eliminates Technology Risk
                </h2>
                <div className="prose prose-stone text-base sm:text-lg text-[#334439] leading-relaxed space-y-4 font-light">
                  <p>
                    Industrial processing facilities frequently suffer from the disconnect between academic technology licensors, foreign equipment vendors, and local civil contractors. Soltex Global eliminates this friction by operating as a unified EPCM provider.
                  </p>
                  <p>
                    Our multidisciplinary engineering core oversees every calculation: from initial raw pomace moisture assays to stainless-steel pipe isometric designs, automated SCADA PLC routines, and regulatory compliance.
                  </p>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5">
              <ScrollReveal delayMs={100}>
                <div className="bg-[#07130E] text-white p-8 border border-[#16211B]/40 shadow-xl relative overflow-hidden">
                  <div className="text-xs font-mono uppercase text-[#BA9B60] tracking-wider mb-2 font-semibold">
                    GUARANTEED DELIVERABLES
                  </div>
                  <h3 className="font-serif text-2xl mb-4 text-[#FBFBF8]">
                    Our Performance Guarantee
                  </h3>
                  <ul className="space-y-3 text-xs font-mono text-[#FBFBF8]/80">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>Guaranteed annual metric ton throughput</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>Verified chemical purity (e.g. 90%+ soy isolate protein)</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>Fixed utility consumption ceilings per ton of finished product</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>Certified local operating staff upon commercial commissioning</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Sequential Visual Workflow Stages */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="max-w-2xl mb-16">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                02 · FULL-CYCLE WORKFLOW
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                Systematic Industrial Execution Architecture
              </h2>
              <p className="text-sm sm:text-base text-[#334439] mt-2 font-light">
                Ten structured stages that guarantee bankable feasibility, compliant engineering, and sustained commercial yield.
              </p>
            </div>
          </ScrollReveal>

          {/* Sequentially revealed stages with integrated imagery */}
          <div className="space-y-16">
            {EPCM_SERVICES_DETAILED.map((stage) => {
              const stageImg = EPCM_STAGE_IMAGES[stage.number];

              return (
                <ScrollReveal key={stage.number}>
                  <div className="bg-white border border-[#16211B]/15 p-6 sm:p-8 lg:p-10 hover:border-[#0E482C] transition-all duration-300 shadow-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Left: Stage Title & Description */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-serif text-[#0E482C] font-bold">
                            STAGE {stage.number}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-[#BA9B60]" />
                          <span className="text-[11px] font-mono text-[#BA9B60] uppercase tracking-wider font-semibold">
                            {stage.subtitle}
                          </span>
                        </div>

                        <h3 className="font-serif text-2xl text-[#121815] font-bold">
                          {stage.stageName}
                        </h3>

                        <p className="text-sm text-[#334439] leading-relaxed font-light">
                          {stage.description}
                        </p>

                        <div className="pt-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 mb-2">
                            Key Actions:
                          </div>
                          <div className="space-y-1.5">
                            {stage.activities.map((act, aIdx) => (
                              <div key={aIdx} className="flex items-start gap-2 text-xs text-[#223328]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                                <span className="font-light">{act}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={() => onOpenProjectModal?.(`Inquiry for EPCM Stage ${stage.number}: ${stage.stageName}`)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white font-mono text-xs uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer"
                          >
                            <span>Inquire on this Stage</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                          </button>
                        </div>
                      </div>

                      {/* Right: Dedicated Industrial Image */}
                      {stageImg && (
                        <div className="lg:col-span-7">
                          <div className="relative aspect-[16/10] overflow-hidden bg-[#07130E] border border-[#16211B]/15 image-zoom-container">
                            <img
                              src={stageImg.src}
                              alt={stageImg.caption}
                              className="w-full h-full object-cover opacity-90 hover:opacity-100"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-white">
                              <span className="text-white/90">{stageImg.caption}</span>
                              <span className="text-[#BA9B60] text-[10px] tracking-wider uppercase font-semibold">
                                EPCM PHASE {stage.number}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section with simplified lead capture */}
      <CtaSection
        badge="PROJECT EXECUTION MANDATE"
        title="Schedule an Engineering Scoping Workshop"
        description="Connect with our lead process engineers and construction directors to map out timeline, CAPEX estimates, and site readiness for your planned plant."
        topic="EPCM Scoping Workshop Request"
      />
    </div>
  );
};
