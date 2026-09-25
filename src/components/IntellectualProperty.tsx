import React, { useState } from 'react';
import { ArrowRight, X, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';

interface IntellectualPropertyProps {
  onOpenProjectModal: (techName?: string) => void;
}

interface PatentCard {
  id: string;
  status: 'PATENT GRANTED' | 'PATENT APPLICATION';
  title: string;
  patentNo: string;
  patentLabel: 'Patent No.' | 'Application No.';
  jurisdiction: string;
  abstract: string;
  claimsSummary: string[];
}

const PATENTS_DATA: PatentCard[] = [
  {
    id: 'apple-pectin',
    status: 'PATENT GRANTED',
    title: 'APPLE PECTIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 66235 B1',
    patentLabel: 'Patent No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Proprietary alcohol-free extraction process and system for high-gelling apple pectin from fresh and dried apple pomace with closed-loop acid recovery.',
    claimsSummary: [
      'Acid-free and alcohol-free hydro-thermal extraction',
      'Ultrafiltration membrane concentration at low thermal stress',
      'High methoxyl esterification preservation (DM > 68%)'
    ]
  },
  {
    id: 'citrus-pectin',
    status: 'PATENT GRANTED',
    title: 'CITRUS PECTIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 63596 B1',
    patentLabel: 'Patent No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Continuous counter-current extraction method for obtaining pharmaceutical and food grade pectin from orange, lemon and grapefruit peels.',
    claimsSummary: [
      'Continuous diffusion extractor with dynamic pH regulation',
      'Integrated essential oil and terpene recovery pre-treatment',
      'Low chemical consumption and reduced effluent volume'
    ]
  },
  {
    id: 'soy-protein',
    status: 'PATENT APPLICATION',
    title: 'SOY PROTEIN ISOLATE PRODUCTION TECHNOLOGY',
    patentNo: 'BG 114363 A1',
    patentLabel: 'Application No.',
    jurisdiction: 'Bulgaria',
    abstract: 'Novel isoelectric precipitation and membrane filtration line yielding neutral-flavor, high-dispersibility soy protein isolate (≥90% protein dry basis).',
    claimsSummary: [
      'Multi-stage aqueous alkaline extraction and decanter separation',
      'Cross-flow ultrafiltration / diafiltration protein fractionation',
      'Flash pasteurization and high-yield gentle spray atomization'
    ]
  },
  {
    id: 'inulin',
    status: 'PATENT APPLICATION',
    title: 'INULIN PRODUCTION TECHNOLOGY',
    patentNo: 'BG 114364 A1',
    patentLabel: 'Application No.',
    jurisdiction: 'Bulgaria',
    abstract: 'High-purity fructan and inulin extraction system from Jerusalem artichoke tubers and chicory roots without harsh chemical decolorization.',
    claimsSummary: [
      'Pulsed electric or cavitation-assisted cell disruption',
      'Continuous chromatographic fractionation for controlled DP spectrum',
      'Crystallization with minimal mother-liquor waste'
    ]
  }
];

export const IntellectualProperty: React.FC<IntellectualPropertyProps> = ({ onOpenProjectModal }) => {
  const { t } = useI18n();
  const [selectedPatent, setSelectedPatent] = useState<PatentCard | null>(null);

  return (
    <section id="intellectual-property" className="w-full bg-[#F5F4EE] border-b border-[#16211B]/12 py-10 sm:py-12 lg:py-14">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 lg:gap-10">
          
          {/* Left Column: Title, Subtitle, and Action Button */}
          <div className="lg:w-[280px] xl:w-[300px] shrink-0 lg:border-e lg:border-[#16211B]/15 lg:pe-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#111814] tracking-tight leading-[1.15] mb-2.5 font-tech uppercase">
              {withLineBreaks(t("TECHNOLOGY &\nINTELLECTUAL PROPERTY"))}
            </h2>
            <p className="text-xs sm:text-[12.5px] text-[#46574D] leading-relaxed mb-5 max-w-[270px] font-normal">
              {t("Our technologies are protected by patents and patent applications in multiple jurisdictions.")}
            </p>
            <div>
              <button
                onClick={() => onOpenProjectModal(t('Intellectual Property Licensing Inquiry'))}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0E482C] text-white text-[10.5px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors rounded-none shadow-xs group cursor-pointer"
              >
                <span>{t("EXPLORE OUR IP PORTFOLIO")}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Right Column: 4 Patent Cards Grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PATENTS_DATA.map((patent) => (
              <div
                key={patent.id}
                onClick={() => setSelectedPatent(patent)}
                className="bg-white border border-[#16211B]/12 p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#0E482C]/50 hover:shadow-xs transition-all duration-200 cursor-pointer group"
              >
                <div>
                  {/* Status Badge */}
                  <div className="flex justify-center mb-3">
                    <span
                      className={`font-tech text-[9px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 border ${
                        patent.status === 'PATENT GRANTED'
                          ? 'border-[#0E482C]/30 text-[#0E482C] bg-[#0E482C]/[0.04]'
                          : 'border-[#16211B]/20 text-[#4E5E55] bg-[#F5F4EE]'
                      }`}
                    >
                      {t(patent.status)}
                    </span>
                  </div>

                  {/* Circular Botanical Raw Material Illustration */}
                  <div className="w-16 h-16 rounded-full bg-[#F5F4EE] border border-[#16211B]/8 flex items-center justify-center mx-auto my-2 group-hover:scale-105 group-hover:border-[#0E482C]/30 transition-all duration-300">
                    {patent.id === 'apple-pectin' && (
                      /* Apple Icon */
                      <svg className="w-8 h-8 text-[#2E7D32]" viewBox="0 0 32 32" fill="none">
                        <path
                          d="M17 5C17 5 19 3 22 4C22 7 19 8 19 8"
                          stroke="#4A6B56"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                        <path
                          d="M16 8C13 8 11 10 9 12C6 15 6 21 9 25C11 28 13.5 28 16 26.5C18.5 28 21 28 23 25C26 21 26 15 23 12C21 10 19 8 16 8Z"
                          fill="#81C784"
                          stroke="#2E7D32"
                          strokeWidth="1.6"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {patent.id === 'citrus-pectin' && (
                      /* Citrus / Leaves Icon */
                      <svg className="w-8 h-8 text-[#F57C00]" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="18" r="9" fill="#FFB74D" stroke="#E65100" strokeWidth="1.6" />
                        <path d="M16 11V25M9 18H23M11 13L21 23M11 23L21 13" stroke="#FFF3E0" strokeWidth="1.2" />
                        <path d="M16 9C16 6 19 5 21 5C21 7 19 9 16 9Z" fill="#66BB6A" stroke="#2E7D32" strokeWidth="1.2" />
                      </svg>
                    )}
                    {patent.id === 'soy-protein' && (
                      /* Soy Pod Icon */
                      <svg className="w-8 h-8 text-[#558B2F]" viewBox="0 0 32 32" fill="none">
                        <path
                          d="M8 24C12 24 16 22 20 18C24 14 25 9 24 7C22 7 17 8 13 12C9 16 8 20 8 24Z"
                          fill="#AED581"
                          stroke="#558B2F"
                          strokeWidth="1.6"
                        />
                        <circle cx="14" cy="18" r="2.2" fill="#689F38" />
                        <circle cx="18" cy="14" r="2.2" fill="#689F38" />
                        <path d="M24 7L26 5" stroke="#33691E" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    )}
                    {patent.id === 'inulin' && (
                      /* Inulin / Artichoke Tuber Root Icon */
                      <svg className="w-8 h-8 text-[#A1887F]" viewBox="0 0 32 32" fill="none">
                        <path
                          d="M10 16C8 18 8 22 11 24C14 26 18 25 20 22C22 19 21 15 18 13C16 12 15 9 16 7C14 7 12 9 11 12C9 13 8 14 10 16Z"
                          fill="#D7CCC8"
                          stroke="#8D6E63"
                          strokeWidth="1.6"
                        />
                        <path d="M12 18C13 17 16 17 17 19M11 21C13 21 15 22 16 23" stroke="#6D4C41" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-tech text-xs font-extrabold text-[#111814] tracking-wide text-center uppercase leading-tight mt-3 mb-4 min-h-[32px] group-hover:text-[#0E482C] transition-colors">
                    {t(patent.title)}
                  </h3>
                </div>

                {/* Bottom Metadata in 2 Columns */}
                <div className="pt-3 border-t border-[#16211B]/10 grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#6D8074] block font-tech">{t(patent.patentLabel)}</span>
                    <span className="font-tech font-extrabold text-[#111814] tracking-wide block truncate">
                      {t(patent.patentNo)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6D8074] block font-tech">{t("Jurisdiction")}</span>
                    <span className="font-tech font-extrabold text-[#111814] tracking-wide block">
                      {t(patent.jurisdiction)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Patent Details Modal */}
      {selectedPatent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedPatent(null)}
        >
          <div
            className="relative w-full max-w-xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPatent(null)}
              className="absolute top-5 end-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label={t("Close modal")}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-[#0E482C]" />
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                {t(selectedPatent.status)}
              </span>
              <span className="text-[#A4B3A9]">/</span>
              <span className="font-tech text-xs text-[#B89758]">{t(selectedPatent.jurisdiction)}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {t(selectedPatent.title)}
            </h3>

            <div className="flex items-center gap-4 text-xs font-tech text-[#5A6D62] mb-4">
              <span><strong>{t("Doc:")}</strong> {t(selectedPatent.patentNo)}</span>
              <span>•</span>
              <span><strong>{t("Jurisdiction:")}</strong> {t(selectedPatent.jurisdiction)}</span>
            </div>

            <p className="text-xs sm:text-sm text-[#46574D] leading-relaxed mb-6">
              {t(selectedPatent.abstract)}
            </p>

            <div className="p-4 sm:p-5 bg-[#F5F3EC] border border-[#16211B]/10 mb-6">
              <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-3">
                {t("KEY PATENT CLAIMS & ADVANTAGES")}
              </h4>
              <ul className="space-y-2 text-xs text-[#3E5045]">
                {selectedPatent.claimsSummary.map((claim, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                    <span>{t(claim)}</span>
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
                {t("CLOSE")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = selectedPatent.title;
                  setSelectedPatent(null);
                  onOpenProjectModal(t("IP Licensing: {title} ({patentNo})", { title: t(title), patentNo: selectedPatent.patentNo }));
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{t("REQUEST IP SPECIFICATION")}</span>
                <ArrowRight className="w-4 h-4 text-[#D4B982]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
