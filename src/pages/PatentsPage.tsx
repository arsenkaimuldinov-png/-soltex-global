import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { ShieldCheck, FileText, CheckCircle2, ArrowRight, Lock, Award, BookOpen, MapPin } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { useI18n } from '../i18n/I18nProvider';


export const PatentsPage: React.FC<{ onOpenProjectModal?: (topic?: InquiryTopic) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { header, c } = usePage('patents');
  const patents = useContent().patents('registry');
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.technologies'), href: '/technologies' }, { label: t('breadcrumb.patents') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('patents', 'inquiryTopic'))
        }}
      />

      {/* Patent Catalog with Industrial Imagery */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-12 pb-4 border-b border-[#16211B]/10">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {c('registryEyebrow')}
                </div>
                <h2 className="font-serif text-3xl text-[#121815] mt-1">
                  {c('registryHeading')}
                </h2>
              </div>
              <div className="text-xs font-mono text-[#334439]/70 uppercase hidden sm:block">
                {tr('patents.count', { count: patents.length })}
              </div>
            </div>
          </ScrollReveal>

          <div className="space-y-12">
            {patents.map((patent, idx) => {
              const plantPhoto = patent.image ? { image: patent.image.src, caption: patent.imageCaption ?? '' } : null;

              return (
                <ScrollReveal key={idx}>
                  <div className="bg-white border border-[#16211B]/15 p-6 sm:p-8 lg:p-10 hover:border-[#0E482C] transition-all duration-300 shadow-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Left: Patent ID & Key Information */}
                      <div className="lg:col-span-5 space-y-4">
                        <div className="inline-flex items-center gap-2 bg-beige-soft border border-taupe/50 px-3 py-1 text-xs font-mono text-[#0E482C] font-bold">
                          <ShieldCheck className="w-4 h-4 text-[#BA9B60]" />
                          <span>{patent.code}</span>
                        </div>

                        <h3 className="font-serif text-2xl lg:text-3xl text-[#121815] font-bold leading-snug">
                          {patent.title}
                        </h3>

                        <div className="text-xs font-mono text-[#334439]/80 space-y-2 pt-2 border-t border-[#16211B]/10">
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                            <span><strong className="text-[#121815]">{t('patents.location')}</strong> {patent.location}</span>
                          </div>
                          <div>
                            <strong className="text-[#121815]">{t('patents.status')}</strong> <span className="text-[#0E482C] font-semibold">{c('statusValue')}</span>
                          </div>
                        </div>

                        <p className="text-sm text-[#334439] leading-relaxed font-light pt-2">
                          {patent.overview}
                        </p>

                        <div className="pt-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-1 font-semibold">
                            {t('patents.commercialDeployment')}
                          </div>
                          <div className="text-xs font-mono text-[#0E482C] font-bold leading-snug">
                            {patent.industrialImplementation}
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={() => onOpenProjectModal?.(topicUi('patents.licensingTopic', { code: topicRef('patent', patent.id, 'code') }))}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white font-mono text-xs uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer s-btn"
                          >
                            <span>{t('patents.license')}</span>
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
                              alt={plantPhoto.caption}
                              className="w-full h-full object-cover opacity-90 hover:opacity-100"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-3 start-3 end-3 text-xs font-mono text-white flex items-center justify-between">
                              <span className="text-white/90 line-clamp-1">{plantPhoto.caption}</span>
                              <span className="text-[#BA9B60] text-[10px] tracking-wider uppercase font-semibold shrink-0 ms-2">
                                {t('patents.physicalReference')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Pillars */}
                        <div className="space-y-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 font-semibold">
                            {t('patents.coreInnovations')}
                          </div>
                          {(patent.keyPillars ?? []).map((pillar, pIdx) => (
                            <div key={pIdx} className="bg-[#FBFBF8] p-3.5 border border-[#16211B]/10">
                              <div className="text-xs font-serif font-bold text-[#121815] flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C]" />
                                <span>{pillar.title}</span>
                              </div>
                              <p className="text-xs text-[#334439] mt-1 font-light leading-relaxed">
                                {pillar.description}
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
      <section className="bg-beige-soft border-y border-taupe/50 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScrollReveal delayMs={50}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <Lock className="w-6 h-6 text-[#0E482C] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{c('assurance1Title')}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {c('assurance1Text')}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <Award className="w-6 h-6 text-[#BA9B60] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{c('assurance2Title')}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {c('assurance2Text')}
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={150}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full">
                <BookOpen className="w-6 h-6 text-[#0E482C] mb-3" />
                <h3 className="font-serif text-lg font-bold mb-2">{c('assurance3Title')}</h3>
                <p className="text-xs text-[#334439] leading-relaxed font-light">
                  {c('assurance3Text')}
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
