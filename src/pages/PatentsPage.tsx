import React from 'react';
import { Link } from '../i18n/Link';
import { ShieldCheck, FileText, CheckCircle2, ArrowRight, Lock, Award, BookOpen, MapPin } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { PATENTS_DATA } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

const PATENT_IMAGERY = [
  {
    image: '/images/flagship_siberian_wellness_1790267904663.jpg',
    caption: 'Namangan Pectin Processing Complex (1,000 t/y output operating under Patent No. 113754)'
  },
  {
    image: '/images/project_soy_israel_1790271724797.jpg',
    caption: 'Industrial Soy Protein Isolate Complex (17,000 t/y operating under Patent RU 2709384 C1)'
  }
];

export const PatentsPage: React.FC<{ onOpenProjectModal?: (topic?: string) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        badgeNumber="04"
        badgeLabel={t("INTELLECTUAL PROPERTY")}
        title={t("Patents, Scientific IP & Licensing")}
        subtitle={t("Proprietary Biochemical Inventions Grounded in Commercial Industrial Plants")}
        description={t("Soltex Global safeguards its clients' market exclusivity through registered international patents and trade secrets covering extraction yields, enzymatic fractionation, and closed-loop biomass valorization.")}
        breadcrumbs={[
          { label: 'Technologies', href: '/technologies' },
          { label: 'Patents & IP' }
        ]}
        metaTags={[
          { label: 'Portfolio Status', value: 'Active Registered IP' },
          { label: 'Key Jurisdictions', value: 'EPO, Israel, Bulgaria, CIS' },
          { label: 'Licensing Model', value: 'Exclusive with Turnkey EPC' },
          { label: 'Industrial Proof', value: 'Validated in Commercial Plants' }
        ]}
        primaryAction={{
          label: 'Request Licensing Dossier',
          onClick: () => onOpenProjectModal?.('Patent Licensing & IP Dossier Request')
        }}
      />

      {/* Patent Catalog with Industrial Imagery */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-12 pb-4 border-b border-[#16211B]/10">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {t("REGISTERED SCIENTIFIC MONOGRAPHS")}
                </div>
                <h2 className="font-serif text-3xl text-[#121815] mt-1">
                  {t("Commercial Patent Portfolio & Reference Assets")}
                </h2>
              </div>
              <div className="text-xs font-mono text-[#334439]/70 uppercase hidden sm:block">
                {tr("{count} REGISTERED INDUSTRIAL PATENTS", { count: PATENTS_DATA.length })}
              </div>
            </div>
          </ScrollReveal>

          <div className="space-y-12">
            {PATENTS_DATA.map((patent, idx) => {
              const plantPhoto = PATENT_IMAGERY[idx % PATENT_IMAGERY.length];

              return (
                <ScrollReveal key={idx}>
                  <div className="bg-white border border-[#16211B]/15 p-6 sm:p-8 lg:p-10 hover:border-[#0E482C] transition-all duration-300 shadow-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Left: Patent ID & Key Information */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="inline-flex items-center gap-2 bg-[#F3F3EC] border border-[#16211B]/15 px-3 py-1 text-xs font-mono text-[#0E482C] font-bold">
                          <ShieldCheck className="w-4 h-4 text-[#BA9B60]" />
                          <span>{t(patent.code)}</span>
                        </div>

                        <h3 className="font-serif text-2xl lg:text-3xl text-[#121815] font-bold leading-snug">
                          {t(patent.title)}
                        </h3>

                        <div className="text-xs font-mono text-[#334439]/80 space-y-2 pt-2 border-t border-[#16211B]/10">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                            <span><strong className="text-[#121815]">{t("LOCATION:")}</strong> {t(patent.location)}</span>
                          </div>
                          <div>
                            <strong className="text-[#121815]">{t("STATUS:")}</strong> <span className="text-[#0E482C] font-semibold">{t("Active & Industrially Scaled")}</span>
                          </div>
                        </div>

                        <p className="text-sm text-[#334439] leading-relaxed font-light pt-2">
                          {t(patent.overview)}
                        </p>

                        <div className="pt-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-1 font-semibold">
                            {t("Commercial Deployment:")}
                          </div>
                          <div className="text-xs font-mono text-[#0E482C] font-bold leading-snug">
                            {t(patent.industrialImplementation)}
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => onOpenProjectModal?.(t("IP Licensing Inquiry for {code}", { code: t(patent.code) }))}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white font-mono text-xs uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer"
                          >
                            <span>{t("License This Patent")}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                          </button>
                        </div>
                      </div>

                      {/* Right: Technical Pillars & Plant Photograph */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Authentic Plant Photo */}
                        {plantPhoto && (
                          <div className="relative aspect-[16/9] overflow-hidden bg-[#07130E] border border-[#16211B]/15 image-zoom-container">
                            <img
                              src={plantPhoto.image}
                              alt={t(plantPhoto.caption)}
                              className="w-full h-full object-cover opacity-90 hover:opacity-100"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-3 start-3 end-3 text-xs font-mono text-white flex items-center justify-between">
                              <span className="text-white/90 line-clamp-1">{t(plantPhoto.caption)}</span>
                              <span className="text-[#BA9B60] text-[10px] tracking-wider uppercase font-semibold shrink-0 ms-2">
                                {t("Physical Reference")}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Pillars */}
                        <div className="space-y-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 font-semibold">
                            {t("Core Technological Innovations:")}
                          </div>
                          {patent.keyPillars.map((pillar, pIdx) => (
                            <div key={pIdx} className="bg-[#FBFBF8] p-3.5 border border-[#16211B]/10">
                              <div className="text-xs font-serif font-bold text-[#121815] flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C]" />
                                <span>{t(pillar.title)}</span>
                              </div>
                              <p className="text-xs text-[#334439] mt-1 font-light leading-relaxed">
                                {t(pillar.description)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Non-Disclosure & IP Security Section */}
      <section className="bg-[#F3F3EC] border-y border-[#16211B]/10 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal delayMs={50}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <Lock className="w-6 h-6 text-[#0E482C] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{t("Confidentiality Guarantee")}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {t("All technology licensing dialogues are governed by standard industrial non-disclosure agreements protecting proprietary know-how and client raw material analyses.")}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <Award className="w-6 h-6 text-[#BA9B60] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{t("Exclusive Territory Protection")}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {t("Turnkey EPC clients may secure defined geographic exclusivity for specific patented processing platforms, guaranteeing protection from regional commodity competition.")}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={150}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <BookOpen className="w-6 h-6 text-[#0E482C] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{t("Continuous Process R&D")}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {t("Soltex Global continually refines separation economics, updating licensed operators with periodic biochemical enhancements and energy optimization recipes.")}
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={t("PATENT LICENSING & IP PORTFOLIO")}
        title={t("Acquire Exclusive Rights to Patented Extraction Technologies")}
        description={t("Our legal and technological licensing team provides full documentation, patent boundary assessments, and turnkey integration for industrial agro-holdings.")}
        topic="Patents & IP Licensing Inquiry"
      />
    </div>
  );
};
