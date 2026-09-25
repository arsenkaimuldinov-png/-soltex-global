import React from 'react';
import { Link } from '../i18n/Link';
import { ArrowRight, CheckCircle2, ShieldCheck, Award, Globe2, Cpu, Factory, Users, ChevronRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { COMPANY_TIMELINE } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

interface AboutPageProps {
  onOpenProjectModal?: (topic?: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onOpenProjectModal }) => {
  const { t } = useI18n();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* 1. Page Header */}
      <PageHeader
        badgeNumber="01"
        badgeLabel={t("CORPORATE PROFILE")}
        title={t("Engineering Technological Sovereignty in Agro-Processing")}
        subtitle={t("30+ Years of Patented Innovations & Industrial Turnkey Delivery")}
        description={t("Soltex Global is an international engineering and EPC enterprise specializing in deep agro-industrial processing. We develop proprietary patented extraction processes and deliver turnkey manufacturing plants that transform plant raw materials into high-margin functional proteins, pectins, and bioactive ingredients.")}
        breadcrumbs={[
          { label: 'Company' },
          { label: 'About' }
        ]}
        metaTags={[
          { label: 'Founded Heritage', value: '30+ Years' },
          { label: 'Core Specialization', value: 'Deep Plant Processing' },
          { label: 'Global Registry', value: 'Sharjah, UAE' },
          { label: 'Execution Scope', value: 'Full-Cycle EPCM' }
        ]}
        primaryAction={{
          label: 'Request Consultation',
          onClick: () => onOpenProjectModal?.('Corporate Consultation Request')
        }}
      />

      {/* 2. TEXT — The Soltex Global Mandate */}
      <section className="py-20 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="max-w-4xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                {t("01 · THE SOLTEX GLOBAL MANDATE")}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#121815] leading-[1.12] mb-8">
                {t("From Laboratory Biochemical Science to Multi-Thousand Ton Commercial Plants")}
              </h2>
              <div className="text-base sm:text-lg text-[#334439] leading-relaxed space-y-5 font-light">
                <p>
                  {t("Soltex Global operates at the intersection of applied biochemical science and large-scale mechanical engineering. While conventional engineering firms rely on generic third-party licenses, Soltex develops and holds proprietary international patents for deep biomass valorization.")}
                </p>
                <p>
                  {t("Our primary focus centers on high-demand, mission-critical food and pharmaceutical ingredients: high-purity soy protein isolates, high-ester and low-ester pectins from fruit pomace, crystalline inulin, and specialized botanical phyto-extracts.")}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/technologies"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors"
                >
                  <span>{t("Explore Proprietary Technologies")}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60]" />
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 px-6 py-3.5 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors"
                >
                  <span>{t("View Industrial Projects")}</span>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 3. LARGE IMAGE — Panoramic Facility Overview */}
      <section className="border-b border-[#16211B]/10 bg-[#07130E] overflow-hidden">
        <ScrollReveal>
          <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[380px] image-zoom-container">
            <img
              src="/images/hero_industrial_plant_1790267866540.jpg"
              alt={t("Soltex Global Turnkey Industrial Processing Complex")}
              className="w-full h-full object-cover opacity-90"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest">
                  {t("COMMERCIAL PROVENANCE · ASHDOD, ISRAEL")}
                </div>
                <div className="font-serif text-xl sm:text-2xl text-[#FBFBF8]">
                  {t("Industrial Soy Protein Isolate Complex (17,000 t/year)")}
                </div>
              </div>
              <div className="text-xs font-mono text-white/70 bg-black/50 px-3 py-1.5 backdrop-blur-xs border border-white/10">
                {t("Continuous Operational Run: 18+ Years")}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 4. TEXT / DATA — Engineering Capabilities & Performance Benchmarks */}
      <section className="py-20 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-5 space-y-6">
              <ScrollReveal>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {t("02 · CORE CAPABILITIES")}
                </div>
                <h3 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {t("Full-Cycle Technological Sovereignty")}
                </h3>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {t("We assume total responsibility across the biological, chemical, civil, and mechanical dimensions of plant construction. Our clients receive a fully functioning business with certified operators, local raw material supply chains, and contractual yield guarantees.")}
                </p>

                <div className="pt-4 grid grid-cols-2 gap-4 border-t border-[#16211B]/10 text-xs font-mono">
                  <div className="bg-[#F3F3EC] p-3.5 border border-[#16211B]/10">
                    <div className="text-[#334439]/70 uppercase">{t("Purity Target")}</div>
                    <div className="text-[#0E482C] font-bold text-lg mt-0.5">{t("> 90% Isolate")}</div>
                  </div>
                  <div className="bg-[#F3F3EC] p-3.5 border border-[#16211B]/10">
                    <div className="text-[#334439]/70 uppercase">{t("Recovery Rate")}</div>
                    <div className="text-[#0E482C] font-bold text-lg mt-0.5">{t("Up to 92%")}</div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  icon: Cpu,
                  title: 'Patented IP',
                  desc: 'Proprietary patents in aqueous extraction, cavitation pectin recovery, and closed-loop process cycles.'
                },
                {
                  icon: Factory,
                  title: 'Turnkey EPCM',
                  desc: 'Single-point execution encompassing feedstock assay, 3D BIM design, custom fabrication, civil erection, and commissioning.'
                },
                {
                  icon: Award,
                  title: 'Yield Guarantees',
                  desc: 'Performance-backed contracts guaranteeing target yields, active compound purity, and energy efficiency ceilings.'
                },
                {
                  icon: Globe2,
                  title: 'Global Footprint',
                  desc: 'Headquartered in the UAE with reference plants operating across Israel, China, Uzbekistan, and Eurasia.'
                }
              ].map((item, idx) => (
                <ScrollReveal key={idx} delayMs={idx * 80}>
                  <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-all duration-300 h-full">
                    <div className="w-10 h-10 bg-[#0E482C]/10 text-[#0E482C] flex items-center justify-center mb-4">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-serif text-lg text-[#121815] mb-2 font-bold">{t(item.title)}</h4>
                    <p className="text-xs text-[#334439] leading-relaxed font-light">{t(item.desc)}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. IMAGE — High-Purity Processing Hall */}
      <section className="py-12 bg-[#F3F3EC]/40 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-white border border-[#16211B]/15 p-6 lg:p-8">
              <div className="md:col-span-7 relative aspect-[16/10] overflow-hidden bg-[#07130E] image-zoom-container">
                <img
                  src="/images/tech_integrated_plant_1790271239031.jpg"
                  alt={t("Process Piping and Automated Control Network")}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="md:col-span-5 space-y-4">
                <div className="text-[10px] font-mono text-[#0E482C] uppercase tracking-widest font-semibold">
                  {t("STAINLESS HYGIENIC ENGINEERING")}
                </div>
                <h3 className="font-serif text-2xl lg:text-3xl text-[#121815]">
                  {t("Automated Cleanroom Standards & Continuous Flow")}
                </h3>
                <p className="text-sm text-[#334439] leading-relaxed font-light">
                  {t("All process contact surfaces are constructed from food-grade AISI 316L stainless steel, integrated with automated Clean-in-Place (CIP) loops and precision PLC/SCADA controls ensuring consistent pharmaceutical purity.")}
                </p>
                <div className="pt-2 text-xs font-mono text-[#0E482C] font-semibold">
                  {t("COMPLIANCE: ISO 22000 · HACCP · GMP · HALAL")}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 6. COMPANY HISTORY — Three Decades Chronicle */}
      <section className="py-20 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="max-w-2xl mb-12">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                {t("03 · INDUSTRIAL CHRONOLOGY")}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                {t("Three Decades of Engineering Milestones")}
              </h2>
              <p className="text-sm sm:text-base text-[#334439] mt-2 font-light">
                {t("Verified chronicle of Soltex Global technological breakthroughs, commercial plant deliveries, and patent filings.")}
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {COMPANY_TIMELINE.map((item, idx) => (
              <ScrollReveal key={idx} delayMs={idx * 60}>
                <div className="bg-white border border-[#16211B]/15 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center hover:border-[#0E482C] transition-all duration-300">
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <div className="text-2xl lg:text-3xl font-serif text-[#0E482C] font-bold">
                      {t(item.year)}
                    </div>
                    <div className="w-px h-8 bg-[#16211B]/15 hidden lg:block ms-4" />
                  </div>

                  <div className="lg:col-span-9">
                    <h3 className="font-serif text-xl text-[#121815] mb-2 font-semibold">
                      {t(item.title)}
                    </h3>
                    <p className="text-sm text-[#334439] leading-relaxed font-light">
                      {t(item.description)}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. LARGE IMAGE — Equipment Erection & Construction Oversight */}
      <section className="border-b border-[#16211B]/10 bg-[#07130E] overflow-hidden">
        <ScrollReveal>
          <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[380px] image-zoom-container">
            <img
              src="/images/video_epcm_facility_1790267893198.jpg"
              alt={t("Soltex Global Turnkey EPCM Construction Site")}
              className="w-full h-full object-cover opacity-85"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest">
                  {t("FULL-CYCLE EPCM SUPERVISION")}
                </div>
                <div className="font-serif text-xl sm:text-2xl text-[#FBFBF8]">
                  {t("From Foundation Rigging to Commercial Hot Trials")}
                </div>
              </div>
              <Link
                to="/epcm"
                className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#BA9B60] uppercase hover:text-white"
              >
                <span>{t("Explore EPCM Process Stages")}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 8. CTA Section with simplified lead capture */}
      <CtaSection
        badge={t("CORPORATE COLLABORATION")}
        title={t("Discuss Plant Development with Soltex Leadership")}
        description={t("Schedule a technical consultation with Soltex Global chemical engineering directors to review project parameters and intellectual property licensing.")}
        topic="Corporate Consultation from About Page"
      />
    </div>
  );
};
