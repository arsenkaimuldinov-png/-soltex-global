import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { ArrowRight, CheckCircle2, ShieldCheck, Award, Globe2, Cpu, Factory, Users, ChevronRight } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { useI18n } from '../i18n/I18nProvider';

/** Icons of the four capability cards, in content order (presentation is code-owned). */
const CAPABILITY_ICONS = [Cpu, Factory, Award, Globe2];

interface AboutPageProps {
  onOpenProjectModal?: (topic?: InquiryTopic) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onOpenProjectModal }) => {
  const { t } = useI18n();
  const { header, c, list, media } = usePage('company');
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* 1. Page Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.company') }, { label: t('breadcrumb.about') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('company', 'inquiryTopic'))
        }}
      />

      {/* 2. TEXT — The Soltex Global Mandate */}
      <section className="py-20 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="max-w-4xl">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                {c('mandateEyebrow')}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#121815] leading-[1.12] mb-8">
                {c('mandateHeading')}
              </h2>
              <div className="text-base sm:text-lg text-[#334439] leading-relaxed space-y-5 font-light">
                <p>
                  {c('mandateParagraph1')}
                </p>
                <p>
                  {c('mandateParagraph2')}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/technologies"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors s-btn"
                >
                  <span>{c('mandateTechnologiesLink')}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60]" />
                </Link>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-2 px-6 py-3.5 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors"
                >
                  <span>{c('mandateProjectsLink')}</span>
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
              src={media('provenanceImage').src}
              alt={c('provenanceImageAlt')}
              className="w-full h-full object-cover opacity-90"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest">
                  {c('provenanceEyebrow')}
                </div>
                <div className="font-serif text-xl sm:text-2xl text-[#FBFBF8]">
                  {c('provenanceTitle')}
                </div>
              </div>
              <div className="text-xs font-mono text-white/70 bg-black/50 px-3 py-1.5 backdrop-blur-xs border border-white/10">
                {c('provenanceNote')}
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
              <ScrollReveal className="space-y-6">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {c('capabilitiesEyebrow')}
                </div>
                <h3 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {c('capabilitiesHeading')}
                </h3>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {c('capabilitiesIntro')}
                </p>

                <div className="pt-4 grid grid-cols-2 gap-4 border-t border-[#16211B]/10 text-xs font-mono">
                  <div className="bg-beige-soft p-3.5 border border-taupe/50">
                    <div className="text-[#334439]/70 uppercase">{c('purityLabel')}</div>
                    <div className="text-[#0E482C] font-bold text-lg mt-0.5">{c('purityValue')}</div>
                  </div>
                  <div className="bg-beige-soft p-3.5 border border-taupe/50">
                    <div className="text-[#334439]/70 uppercase">{c('recoveryLabel')}</div>
                    <div className="text-[#0E482C] font-bold text-lg mt-0.5">{c('recoveryValue')}</div>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {list<{ title: string; description: string }>('capabilities').map((item, idx) => (
                <ScrollReveal key={idx} delayMs={idx * 80}>
                  <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-all duration-300 h-full">
                    <div className="w-10 h-10 bg-[#0E482C]/10 text-[#0E482C] flex items-center justify-center mb-4">
                      {React.createElement(CAPABILITY_ICONS[idx % CAPABILITY_ICONS.length], { className: 'w-5 h-5' })}
                    </div>
                    <h4 className="font-serif text-lg text-[#121815] mb-2 font-bold">{item.title}</h4>
                    <p className="text-xs text-[#334439] leading-relaxed font-light">{item.description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. IMAGE — High-Purity Processing Hall */}
      <section className="py-12 bg-beige-soft border-b border-taupe/50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-white border border-[#16211B]/15 p-6 lg:p-8">
              <div className="md:col-span-7 relative aspect-[16/10] overflow-hidden bg-[#07130E] image-zoom-container">
                <img
                  src={media('hygienicImage').src}
                  alt={c('hygienicImageAlt')}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="md:col-span-5 space-y-4">
                <div className="text-[10px] font-mono text-[#0E482C] uppercase tracking-widest font-semibold">
                  {c('hygienicEyebrow')}
                </div>
                <h3 className="font-serif text-2xl lg:text-3xl text-[#121815]">
                  {c('hygienicTitle')}
                </h3>
                <p className="text-sm text-[#334439] leading-relaxed font-light">
                  {c('hygienicText')}
                </p>
                <div className="pt-2 text-xs font-mono text-[#0E482C] font-semibold">
                  {c('hygienicCompliance')}
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
                {c('timelineEyebrow')}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                {c('timelineHeading')}
              </h2>
              <p className="text-sm sm:text-base text-[#334439] mt-2 font-light">
                {c('timelineIntro')}
              </p>
            </div>
          </ScrollReveal>

          <div className="space-y-6">
            {list<{ year: string; title: string; description: string }>('timeline').map((item, idx) => (
              <ScrollReveal key={idx} delayMs={idx * 60}>
                <div className="bg-white border border-[#16211B]/15 p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center hover:border-[#0E482C] transition-all duration-300">
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <div className="text-2xl lg:text-3xl font-serif text-[#0E482C] font-bold">
                      {item.year}
                    </div>
                    <div className="w-px h-8 bg-[#16211B]/15 hidden lg:block ms-4" />
                  </div>

                  <div className="lg:col-span-9">
                    <h3 className="font-serif text-xl text-[#121815] mb-2 font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#334439] leading-relaxed font-light">
                      {item.description}
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
              src={media('epcmImage').src}
              alt={c('epcmImageAlt')}
              className="w-full h-full object-cover opacity-85"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest">
                  {c('epcmEyebrow')}
                </div>
                <div className="font-serif text-xl sm:text-2xl text-[#FBFBF8]">
                  {c('epcmTitle')}
                </div>
              </div>
              <Link
                to="/epcm"
                className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#BA9B60] uppercase hover:text-white"
              >
                <span>{c('epcmLink')}</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 8. CTA Section with simplified lead capture */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
