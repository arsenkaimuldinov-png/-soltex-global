import React from 'react';
import { Link } from '../i18n/Link';
import { CheckCircle2, ArrowRight, ShieldCheck, Factory, Cpu, Layers, HardHat, FileSpreadsheet, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { EpcmProcessRail, useEpcmProgress } from '../components/EpcmProcessRail';
import { EPCM_STAGES } from '../data/soltexData';
import { useI18n } from '../i18n/I18nProvider';

// Illustration per approved EPCM stage (keyed by stage number). Stage content comes from EPCM_STAGES.
const EPCM_STAGE_IMAGES: Record<string, string> = {
  '01': '/images/tech_lab_flasks_1790271257443.jpg',
  '02': '/images/tech_citrus_oranges_1790271213504.jpg',
  '03': '/images/tech_integrated_plant_1790271239031.jpg',
  '04': '/images/video_epcm_facility_1790267893198.jpg',
  '05': '/images/video_plant_processing_1790267879744.jpg',
  '06': '/images/hero_plant_pristine_1790269454820.jpg',
  '07': '/images/flagship_siberian_wellness_1790267904663.jpg',
  '08': '/images/hero_industrial_plant_1790267866540.jpg'
};

interface EpcmPageProps {
  onOpenProjectModal?: (topic?: string) => void;
}

export const EpcmPage: React.FC<EpcmPageProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const progress = useEpcmProgress(EPCM_STAGES.length);
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        badgeNumber="05"
        badgeLabel={t("TURNKEY DELIVERY")}
        title={t("Full-Cycle EPCM Industrial Services")}
        subtitle={t("From Laboratory Concept to Continuous Multi-Ton Commercial Production")}
        description={t("Soltex Global delivers complex deep agro-processing installations under unified Engineering, Procurement, Construction Management (EPCM) and turnkey EPC models. We assume total technical responsibility from biomass testing to operational yield guarantees.")}
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
              <ScrollReveal className="space-y-6">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {t("01 · THE EPCM PHILOSOPHY")}
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {t("Single-Point Responsibility Eliminates Technology Risk")}
                </h2>
                <div className="prose prose-stone text-base sm:text-lg text-[#334439] leading-relaxed space-y-4 font-light">
                  <p>
                    {t("Industrial processing facilities frequently suffer from the disconnect between academic technology licensors, foreign equipment vendors, and local civil contractors. Soltex Global eliminates this friction by operating as a unified EPCM provider.")}
                  </p>
                  <p>
                    {t("Our multidisciplinary engineering core oversees every calculation: from initial raw pomace moisture assays to stainless-steel pipe isometric designs, automated SCADA PLC routines, and regulatory compliance.")}
                  </p>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5">
              <ScrollReveal delayMs={100}>
                <div className="bg-[#07130E] text-white p-8 border border-[#16211B]/40 shadow-xl relative overflow-hidden">
                  <div className="text-xs font-mono uppercase text-[#BA9B60] tracking-wider mb-2 font-semibold">
                    {t("GUARANTEED DELIVERABLES")}
                  </div>
                  <h3 className="font-serif text-2xl mb-4 text-[#FBFBF8]">
                    {t("Our Performance Guarantee")}
                  </h3>
                  <ul className="space-y-3 text-xs font-mono text-[#FBFBF8]/80">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{t("Guaranteed annual metric ton throughput")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{t("Verified chemical purity (e.g. 90%+ soy isolate protein)")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{t("Fixed utility consumption ceilings per ton of finished product")}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{t("Certified local operating staff upon commercial commissioning")}</span>
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
                {t("02 · FULL-CYCLE WORKFLOW")}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                {t("Systematic Industrial Execution Architecture")}
              </h2>
              <p className="text-sm sm:text-base text-[#334439] mt-2 font-light">
                {t("Eight structured stages that guarantee bankable feasibility, compliant engineering, and sustained commercial yield.")}
              </p>
            </div>
          </ScrollReveal>

          {/* Sequentially revealed stages with integrated imagery */}
          <div ref={progress.listRef} className="relative space-y-16">
            <EpcmProcessRail fillRef={progress.fillRef} nodeTops={progress.nodeTops} active={progress.active} />
            {EPCM_STAGES.map((stage, stageIdx) => {
              const stageImg = EPCM_STAGE_IMAGES[stage.number];

              return (
                <ScrollReveal key={stage.number}>
                  <div
                    data-epcm-stage
                    className={`epcm-stage-card relative bg-white border border-[#16211B]/15 p-6 sm:p-8 lg:p-10 hover:border-[#0E482C] transition-all duration-300 shadow-xs ${
                      stageIdx === progress.active ? 'is-active' : ''
                    }`}
                  >
                    <span aria-hidden="true" className="epcm-stage-line absolute top-0 inset-x-0 h-[2px] bg-[#0E482C]" />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Left: Stage Title & Description */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-serif text-[#0E482C] font-bold">
                            {tr("STAGE {number}", { number: stage.number })}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-[#BA9B60]" />
                          <span className="text-[11px] font-mono text-[#BA9B60] uppercase tracking-wider font-semibold">
                            {t(stage.focus)}
                          </span>
                        </div>

                        <h3 className="font-serif text-2xl text-[#121815] font-bold">
                          {t(stage.title)}
                        </h3>

                        <p className="text-sm text-[#334439] leading-relaxed font-light">
                          {t(stage.description)}
                        </p>

                        <div className="pt-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 mb-2">
                            {t("KEY DELIVERABLES & SCOPE")}
                          </div>
                          <div className="space-y-1.5">
                            {stage.deliverables.map((act, aIdx) => (
                              <div key={aIdx} className="flex items-start gap-2 text-xs text-[#223328]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                                <span className="font-light">{t(act)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={() => onOpenProjectModal?.(t("Inquiry for EPCM Stage {number}: {name}", { number: stage.number, name: t(stage.title) }))}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white font-mono text-xs uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer s-btn"
                          >
                            <span>{t("Inquire on this Stage")}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                          </button>
                        </div>
                      </div>

                      {/* Right: Dedicated Industrial Image */}
                      {stageImg && (
                        <div className="lg:col-span-7">
                          <div className="relative aspect-[16/10] overflow-hidden bg-[#07130E] border border-[#16211B]/15 image-zoom-container">
                            <img
                              src={stageImg}
                              alt={t(stage.title)}
                              className="w-full h-full object-cover opacity-90 hover:opacity-100"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 start-3 end-3 flex items-end justify-end gap-3 text-xs font-mono text-white">
                              <span className="text-[#BA9B60] text-[10px] tracking-wider uppercase font-semibold whitespace-nowrap shrink-0">
                                {tr("EPCM PHASE {number}", { number: stage.number })}
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
        badge={t("PROJECT EXECUTION MANDATE")}
        title={t("Schedule an Engineering Scoping Workshop")}
        description={t("Connect with our lead process engineers and construction directors to map out timeline, CAPEX estimates, and site readiness for your planned plant.")}
        topic="EPCM Scoping Workshop Request"
      />
    </div>
  );
};
