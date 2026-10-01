import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { CheckCircle2, ArrowRight, ShieldCheck, Factory, Cpu, Layers, HardHat, FileSpreadsheet, Sparkles } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { EpcmProcessRail, useEpcmProgress } from '../components/EpcmProcessRail';
import { useI18n } from '../i18n/I18nProvider';


interface EpcmPageProps {
  onOpenProjectModal?: (topic?: InquiryTopic) => void;
}

export const EpcmPage: React.FC<EpcmPageProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { header, c } = usePage('epcm');
  const stages = useContent().epcmStages;
  const progress = useEpcmProgress(stages.length);
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.epcm') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('epcm', 'inquiryTopic'))
        }}
      />

      {/* Intro Context with Architectural Photo */}
      <section className="py-16 lg:py-20 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <ScrollReveal className="space-y-6">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {c('philosophyEyebrow')}
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {c('philosophyHeading')}
                </h2>
                <div className="prose prose-stone text-base sm:text-lg text-[#334439] leading-relaxed space-y-4 font-light">
                  <p>
                    {c('philosophyParagraph1')}
                  </p>
                  <p>
                    {c('philosophyParagraph2')}
                  </p>
                </div>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-5">
              <ScrollReveal delayMs={100}>
                <div className="bg-[#07130E] text-white p-8 border border-[#16211B]/40 shadow-xl relative overflow-hidden">
                  <div className="text-xs font-mono uppercase text-[#BA9B60] tracking-wider mb-2 font-semibold">
                    {c('guaranteeEyebrow')}
                  </div>
                  <h3 className="font-serif text-2xl mb-4 text-[#FBFBF8]">
                    {c('guaranteeTitle')}
                  </h3>
                  <ul className="space-y-3 text-xs font-mono text-[#FBFBF8]/80">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{c('guaranteeItem1')}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{c('guaranteeItem2')}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{c('guaranteeItem3')}</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                      <span>{c('guaranteeItem4')}</span>
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
                {c('workflowEyebrow')}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                {c('workflowHeading')}
              </h2>
              <p className="text-sm sm:text-base text-[#334439] mt-2 font-light">
                {c('workflowIntro')}
              </p>
            </div>
          </ScrollReveal>

          {/* Sequentially revealed stages with integrated imagery */}
          <div ref={progress.listRef} className="relative space-y-16">
            <EpcmProcessRail fillRef={progress.fillRef} nodeTops={progress.nodeTops} active={progress.active} />
            {stages.map((stage, stageIdx) => {
              const stageImg = stage.image?.src;

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
                            {tr('epcm.stageNumber', { number: stage.number })}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-[#BA9B60]" />
                          <span className="text-[11px] font-mono text-[#BA9B60] uppercase tracking-wider font-semibold">
                            {stage.focus}
                          </span>
                        </div>

                        <h3 className="font-serif text-2xl text-[#121815] font-bold">
                          {stage.title}
                        </h3>

                        <p className="text-sm text-[#334439] leading-relaxed font-light">
                          {stage.description}
                        </p>

                        <div className="pt-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/60 mb-2">
                            {t('epcm.keyDeliverables')}
                          </div>
                          <div className="space-y-1.5">
                            {stage.deliverables.map((act, aIdx) => (
                              <div key={aIdx} className="flex items-start gap-2 text-xs text-[#223328]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                                <span className="font-light">{act}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4">
                          <button
                            onClick={() => onOpenProjectModal?.(topicUi('epcm.stageInquiryTopicNumbered', { number: stage.number, name: topicRef('epcmStage', stage.id) }))}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white font-mono text-xs uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer s-btn"
                          >
                            <span>{t('epcm.inquireStage')}</span>
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
                              alt={stage.title}
                              className="w-full h-full object-cover opacity-90 hover:opacity-100"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 start-3 end-3 flex items-end justify-end gap-3 text-xs font-mono text-white">
                              <span className="text-[#BA9B60] text-[10px] tracking-wider uppercase font-semibold whitespace-nowrap shrink-0">
                                {tr('epcm.phaseNumber', { number: stage.number })}
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
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
