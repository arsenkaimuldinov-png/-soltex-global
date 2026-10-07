import React, { useState } from 'react';
import { topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { ArrowRight, X, CheckCircle2 } from 'lucide-react';
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

          {/* Right Column: the approved stages as a sequence of circle nodes on one line.
              The circle is the system's curve and motion element (Design Direction V1.0 §3);
              the node carries the stage number instead of a pictogram (V1.0 §2). */}
          {/* Below xl the step row scrolls horizontally; the soft fade at the trailing edge signals that more steps follow */}
          <div className="flex-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none max-xl:[mask-image:linear-gradient(to_right,#000_80%,transparent)] rtl:max-xl:[mask-image:linear-gradient(to_left,#000_80%,transparent)]">
            <div data-reveal-group className="flex items-start min-w-[840px] ps-2 pe-16 xl:pe-2">
              {stages.map((step, idx) => (
                <React.Fragment key={step.id}>
                  {/* Step Item */}
                  <button
                    type="button"
                    onClick={() => setActiveStepModal(step)}
                    data-reveal="step"
                    style={{ '--rv-i': idx * 1.6 } as React.CSSProperties}
                    className="flex flex-col items-center shrink-0 w-[92px] group cursor-pointer text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E482C]"
                  >
                    {/* Stage node: thin circle with the stage number */}
                    <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FBFBF8] border-[1.5px] border-[#0E482C]/45 flex items-center justify-center font-tech text-[13px] sm:text-sm font-bold text-[#0E482C] tabular-nums group-hover:bg-[#0E482C] group-hover:border-[#0E482C] group-hover:text-white transition-colors duration-300" aria-hidden="true">
                      {step.number}
                    </span>

                    {/* Step Title */}
                    <span className="font-tech text-[10px] sm:text-[10.5px] font-extrabold text-[#111814] tracking-wider uppercase leading-tight text-center max-w-[92px] epcm-step-title mt-2.5 group-hover:text-[#0E482C] transition-colors">
                      {step.title}
                    </span>
                  </button>

                  {/* Hairline connector between nodes (drawn in reading direction) */}
                  {idx < stages.length - 1 && (
                    <span data-reveal="line" style={{ '--rv-i': idx * 1.6 + 0.8 } as React.CSSProperties} className="flex-1 min-w-3 h-px bg-[#0E482C]/30 mt-6 sm:mt-7" aria-hidden="true" />
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
