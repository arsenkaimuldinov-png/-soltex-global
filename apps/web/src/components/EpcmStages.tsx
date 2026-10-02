import React, { useState } from 'react';
import { topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { ArrowRight, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';
import { Link } from '../i18n/Link';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../motion/usePresence';
import { useContent, usePage } from '../content/useContent';
import type { EpcmStage } from '../content/types';

interface EpcmStagesProps {
  onOpenProjectModal: (topic?: InquiryTopic) => void;
}

/* Icon per approved stage (presentation only — stage content comes from the EPCM stage collection). */
const icon = (children: React.ReactNode) => (
  <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const STAGE_ICONS: Record<string, React.ReactNode> = {
  // 01 Feasibility study — target
  'stage-01': icon(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>),
  // 02 Concept & technical assignment — specification document
  'stage-02': icon(<><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /><path d="M8.5 12h7M8.5 15.5h7M8.5 19h4" /></>),
  // 03 Engineering & design — plant structure
  'stage-03': icon(<><rect x="3" y="10" width="7" height="11" /><rect x="14" y="4" width="7" height="17" /><path d="M10 14h4M10 18h4M6 14v4M17 8v2M17 14v4" /></>),
  // 04 Equipment supply — supply cart
  'stage-04': icon(<><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.5 2.5h3l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>),
  // 05 Construction & installation — site team
  'stage-05': icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  // 06 Commissioning & cold runs — checklist
  'stage-06': icon(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 3v3h6V3" /><path d="m9 12 2 2 4-4" /><path d="M9 18h6" /></>),
  // 07 Reaching design capacity — ramp-up chart
  'stage-07': icon(<><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /><circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" /><circle cx="13.5" cy="15.5" r="1.5" fill="currentColor" /></>),
  // 08 Maintenance & support — wrench
  'stage-08': icon(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />),
};

export const EpcmStages: React.FC<EpcmStagesProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { c } = usePage('home');
  const stages = useContent().epcmStages;
  const [activeStepModal, setActiveStepModal] = useState<EpcmStage | null>(null);
  const closeStepModal = React.useCallback(() => setActiveStepModal(null), []);
  useDialog(!!activeStepModal, closeStepModal);
  const stepModalPresence = usePresence(activeStepModal, 220);
  const stepModal = stepModalPresence.item;

  return (
    <section id="epcm" className="w-full bg-beige-soft border-b border-[#16211B]/12 py-10 sm:py-12 lg:py-14">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 lg:gap-10">
          
          {/* Left Column: Title, Subtitle, and Action Button */}
          <div data-reveal-group className="lg:w-[280px] xl:w-[300px] shrink-0 lg:border-e lg:border-taupe/60 lg:pe-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#111814] tracking-tight leading-[1.12] mb-2.5 font-tech uppercase">
              {withLineBreaks(c('epcmHeading'))}
            </h2>
            <p data-reveal="up" className="text-xs sm:text-[12.5px] text-[#46574D] leading-relaxed mb-5 max-w-[260px] font-normal">
              {c('epcmIntro')}
            </p>
            <div data-reveal="up">
              <Link
                to="/epcm"
                className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0E482C] text-white text-[10.5px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors rounded-none shadow-xs group cursor-pointer s-btn"
              >
                <span>{c('epcmLink')}</span>
              </Link>
            </div>
          </div>

          {/* Right Column: 7 Sequential Process Steps Connected by Arrows */}
          {/* Below xl the step row scrolls horizontally; the soft fade at the trailing edge signals that more steps follow */}
          <div className="flex-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none max-xl:[mask-image:linear-gradient(to_right,#000_80%,transparent)] rtl:max-xl:[mask-image:linear-gradient(to_left,#000_80%,transparent)]">
            <div data-reveal-group className="flex items-center justify-between min-w-[780px] xl:min-w-[840px] ps-2 pe-16 xl:pe-2">
              {stages.map((step, idx) => (
                <React.Fragment key={step.id}>
                  {/* Step Item */}
                  <button
                    type="button"
                    onClick={() => setActiveStepModal(step)}
                    data-reveal="step"
                    style={{ '--rv-i': idx * 1.6 } as React.CSSProperties}
                    className="flex flex-col items-center group cursor-pointer text-center px-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E482C]"
                  >
                    {/* Circular Icon Badge */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-[#16211B]/12 shadow-2xs flex items-center justify-center text-[#0E482C] group-hover:border-[#0E482C] group-hover:scale-105 group-hover:shadow-sm group-hover:ring-4 group-hover:ring-beige transition-all duration-300">
                      {STAGE_ICONS[`stage-${step.number}`]}
                    </div>

                    {/* Step Title */}
                    <span className="font-tech text-[10px] sm:text-[10.5px] font-extrabold text-[#111814] tracking-wider uppercase leading-tight text-center max-w-[95px] epcm-step-title mt-2.5 group-hover:text-[#0E482C] transition-colors">
                      {step.title}
                    </span>
                  </button>

                  {/* Connecting Arrow between steps */}
                  {idx < stages.length - 1 && (
                    <div data-reveal="line" style={{ '--rv-i': idx * 1.6 + 0.8 } as React.CSSProperties} className="shrink-0 text-[#8C9E93] opacity-60 flex items-center justify-center -mt-6">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-current fill-none stroke-[1.8] rtl:-scale-x-100" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Detail Modal for Process Step */}
      {stepModal && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs s-backdrop ${stepModalPresence.exiting ? 'is-exiting' : ''}`}
          onClick={() => setActiveStepModal(null)}
        >
          <div
            className="s-panel relative w-full max-w-xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveStepModal(null)}
              className="absolute top-5 end-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label={t('common.closeModal')}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                {tr('epcm.stageLabel', { number: stepModal.number })}
              </span>
              <span className="text-[#A4B3A9]">/</span>
              <span className="font-tech text-xs text-[#B89758]">{stepModal.focus}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {stepModal.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#46574D] mb-6">
              {stepModal.description}
            </p>

            <div className="p-4 sm:p-5 bg-[#F5F3EC] border border-[#16211B]/10 mb-6">
              <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-3">
                {t('epcm.keyDeliverables')}
              </h4>
              <ul className="space-y-2 text-xs text-[#3E5045]">
                {stepModal.deliverables.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#16211B]/10">
              <button
                type="button"
                onClick={() => setActiveStepModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 border border-[#16211B]/20 text-xs font-bold uppercase font-tech text-[#4A5B51] hover:bg-[#F3F3EC] transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const stepId = stepModal.id;
                  setActiveStepModal(null);
                  onOpenProjectModal(topicUi('epcm.stageInquiryTopic', { name: topicRef('epcmStage', stepId) }));
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs s-btn"
              >
                <span>{t('epcm.consultStage')}</span>
                <ArrowRight className="w-4 h-4 text-[#D4B982]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
