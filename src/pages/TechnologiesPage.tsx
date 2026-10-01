import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { ArrowRight, ShieldCheck, Cpu, CheckCircle2, ChevronRight, Layers, FileText } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import type { Technology as TechnologyItem } from '../content/types';
import { useI18n } from '../i18n/I18nProvider';

interface TechnologiesPageProps {
  onOpenProjectModal?: (topic?: InquiryTopic) => void;
}

export const TechnologiesPage: React.FC<TechnologiesPageProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { header, c } = usePage('technologies');
  const { technologies } = useContent();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.technologies') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('technologies', 'inquiryTopic'))
        }}
      />

      {/* Visual Editorial Technology Roster */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 mb-12 pb-4 border-b border-[#16211B]/10">
            <div className="text-xs font-mono uppercase tracking-widest text-[#334439]">
              {tr('technologies.count', { count: <span className="font-bold text-[#0E482C]">{technologies.length}</span> })}
            </div>
            <Link
              to="/technologies/patents"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#0E482C] uppercase font-bold hover:underline"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{c('patentRegistryLink')}</span>
            </Link>
          </div>

          {/* Alternating Large Image & Technical Content Blocks */}
          <div className="space-y-16 lg:space-y-24">
            {technologies.map((tech: TechnologyItem, idx: number) => {
              const isEven = idx % 2 === 1;

              return (
                <ScrollReveal key={tech.slug}>
                  <article className="s-card border border-[#16211B]/15 bg-white p-6 sm:p-8 lg:p-10 shadow-xs hover:border-[#0E482C] transition-all duration-300">
                    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center ${isEven ? 'lg:flex-row-reverse' : ''}`}>
                      
                      {/* Text Column */}
                      <div className={`lg:col-span-6 space-y-5 ${isEven ? 'lg:order-2' : 'lg:order-1'}`}>
                        <div className="flex items-center gap-3">
                          <span className="s-num font-mono text-2xl lg:text-3xl text-[#0E482C] font-bold">
                            {tech.categoryNumber}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-[#BA9B60]" />
                          <span className="text-xs font-mono text-[#334439]/70 uppercase tracking-widest font-semibold">
                            {tech.categoryTitle}
                          </span>
                        </div>

                        <h2 className="font-serif text-3xl sm:text-4xl text-[#121815] leading-tight">
                          <Link to={`/technologies/${tech.slug}`} className="hover:text-[#0E482C] transition-colors">
                            {tech.title}
                          </Link>
                        </h2>

                        <div className="font-serif italic text-base sm:text-lg text-[#0E482C]">
                          {tech.subtitle}
                        </div>

                        <p className="text-sm sm:text-base text-[#334439] leading-relaxed font-light">
                          {tech.overview}
                        </p>

                        {/* Raw materials chips */}
                        <div className="pt-2">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 mb-2">
                            {t('technologies.compatibleFeedstocks')}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {tech.rawMaterials.map((mat, mIdx) => (
                              <span key={mIdx} className="bg-beige-soft px-2.5 py-1 text-xs font-mono text-[#223328] border border-taupe/50">
                                {mat}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Link & Patent Info */}
                        <div className="pt-4 border-t border-[#16211B]/10 flex flex-wrap items-center justify-between gap-4">
                          <Link
                            to={`/technologies/${tech.slug}`}
                            className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#0E482C] text-white font-mono text-xs font-semibold tracking-widest uppercase hover:bg-[#07130E] transition-colors group s-btn"
                          >
                            <span>{t('technologies.exploreDossier')}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                          </Link>

                          {tech.patentInfo && (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-[#0E482C] bg-beige-soft px-3 py-1.5 border border-taupe/50">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#BA9B60]" />
                              <span>{tech.patentInfo.patentNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Large Industrial Image Column */}
                      <div className={`lg:col-span-6 ${isEven ? 'lg:order-1' : 'lg:order-2'}`}>
                        <Link to={`/technologies/${tech.slug}`} className="block relative aspect-[16/10] overflow-hidden bg-[#07130E] border border-[#16211B]/15 image-zoom-container group">
                          <img
                            src={tech.image.src}
                            alt={tech.title}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
                            loading="lazy"
                          />
                          <div className="s-overlay absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                          <div className="absolute bottom-4 start-4 end-4 flex items-end justify-between gap-3 text-white text-xs font-mono">
                            <span className="text-[#BA9B60] tracking-wider uppercase font-semibold min-w-0">
                              {t('technologies.stageVerified')}
                            </span>
                            <span className="text-white/80 group-hover:text-white flex items-center gap-1 whitespace-nowrap shrink-0">
                              {t('technologies.viewSpecs')}{" "}<ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </Link>
                      </div>

                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section with simplified form */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
