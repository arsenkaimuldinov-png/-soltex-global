import React, { useState } from 'react';
import { topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';
import { Link } from '../i18n/Link';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../motion/usePresence';
import { useContent, usePage } from '../content/useContent';
import type { Patent } from '../content/types';

interface IntellectualPropertyProps {
  onOpenProjectModal: (topic?: InquiryTopic) => void;
}

type PatentCard = Patent;

export const IntellectualProperty: React.FC<IntellectualPropertyProps> = ({ onOpenProjectModal }) => {
  const { t } = useI18n();
  const { c } = usePage('home');
  const patents = useContent().patents('home');
  const [selectedPatent, setSelectedPatent] = useState<PatentCard | null>(null);
  const closePatent = React.useCallback(() => setSelectedPatent(null), []);
  useDialog(!!selectedPatent, closePatent);
  const patentModalPresence = usePresence(selectedPatent, 220);
  const patentModal = patentModalPresence.item;

  return (
    <section id="intellectual-property" className="w-full bg-beige-soft border-b border-[#16211B]/12 py-10 sm:py-12 lg:py-14">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 lg:gap-10">
          
          {/* Left Column: Title, Subtitle, and Action Button */}
          <div data-reveal-group className="lg:w-[280px] xl:w-[300px] shrink-0 lg:border-e lg:border-taupe/60 lg:pe-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#111814] tracking-tight leading-[1.15] mb-2.5 font-tech uppercase">
              {withLineBreaks(c('ipHeading'))}
            </h2>
            <p data-reveal="up" className="text-xs sm:text-[12.5px] text-[#46574D] leading-relaxed mb-5 max-w-[270px] font-normal">
              {c('ipIntro')}
            </p>
            <div data-reveal="up">
              <Link
                to="/technologies/patents"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0E482C] text-white text-[10.5px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors rounded-none shadow-xs group cursor-pointer s-btn"
              >
                <span>{c('ipLink')}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right Column: 4 Patent Cards Grid */}
          <div data-reveal-group className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {patents.map((patent) => (
              <div
                key={patent.id}
                data-reveal="up"
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                onClick={() => setSelectedPatent(patent)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedPatent(patent);
                  }
                }}
                className="s-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E482C] bg-white border border-[#16211B]/12 p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#0E482C]/50 transition-colors duration-200 cursor-pointer group"
              >
                <div>
                  {/* Status Badge. Patent cards are records (status · title · number · jurisdiction);
                      no botanical illustration (Design Direction V1.0 §2, §3). */}
                  <div className="flex mb-4">
                    <span
                      className={`font-tech text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border ${
                        patent.legalStatus === 'granted'
                          ? 'border-[#0E482C]/30 text-[#0E482C] bg-[#0E482C]/[0.04]'
                          : 'border-[#16211B]/20 text-[#4E5E55] bg-[#F5F4EE]'
                      }`}
                    >
                      {patent.statusLabel}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-tech text-xs font-extrabold text-[#111814] tracking-wide uppercase leading-snug mb-6 min-h-[32px] group-hover:text-[#0E482C] transition-colors">
                    {patent.title}
                  </h3>
                </div>

                {/* Bottom Metadata in 2 Columns */}
                <div className="pt-3 border-t border-[#16211B]/10 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#6D8074] block font-tech">{patent.patentLabel}</span>
                    <span className="font-tech font-extrabold text-[#111814] tracking-wide block truncate">
                      {patent.patentNo}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6D8074] block font-tech">{t('patent.jurisdiction')}</span>
                    <span className="font-tech font-extrabold text-[#111814] tracking-wide block">
                      {patent.jurisdiction}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Patent Details Modal */}
      {patentModal && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs s-backdrop ${patentModalPresence.exiting ? 'is-exiting' : ''}`}
          onClick={() => setSelectedPatent(null)}
        >
          <div
            className="s-panel relative w-full max-w-xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPatent(null)}
              className="absolute top-5 end-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label={t('common.closeModal')}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-[#0E482C]" />
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                {patentModal.statusLabel}
              </span>
              <span className="text-[#A4B3A9]">/</span>
              <span className="font-tech text-xs text-[#B89758]">{patentModal.jurisdiction}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {patentModal.title}
            </h3>

            <div className="flex items-center gap-4 text-xs font-tech text-[#5A6D62] mb-4">
              <span><strong>{t('patent.doc')}</strong> {patentModal.patentNo}</span>
              <span>•</span>
              <span><strong>{t('patent.jurisdictionColon')}</strong> {patentModal.jurisdiction}</span>
            </div>

            <p className="text-xs sm:text-sm text-[#46574D] leading-relaxed mb-6">
              {patentModal.abstract}
            </p>

            <div className="p-4 sm:p-5 bg-[#F5F3EC] border border-[#16211B]/10 mb-6">
              <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-3">
                {t('patent.keyClaims')}
              </h4>
              <ul className="space-y-2 text-xs text-[#3E5045]">
                {(patentModal.claimsSummary ?? []).map((claim, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                    <span>{claim}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#16211B]/10">
              <button
                type="button"
                onClick={() => setSelectedPatent(null)}
                className="w-full sm:w-auto px-5 py-2.5 border border-[#16211B]/20 text-xs font-bold uppercase font-tech text-[#4A5B51] hover:bg-[#F3F3EC] transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = patentModal.id;
                  setSelectedPatent(null);
                  onOpenProjectModal(topicUi('patent.licensingTopic', { title: topicRef('patent', id), patentNo: patentModal.patentNo }));
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs s-btn"
              >
                <span>{t('patent.requestSpecification')}</span>
                <ArrowRight className="w-4 h-4 text-[#D4B982]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
