import React, { useState } from 'react';
import { ArrowRight, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';

interface EpcmStagesProps {
  onOpenProjectModal: (preselectedTech?: string) => void;
}

interface StepItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  deliverables: string[];
  focus: string;
}

const EPCM_STEPS: StepItem[] = [
  {
    id: 'concept',
    number: '01',
    title: 'CONCEPT & FEASIBILITY',
    subtitle: 'Preliminary analysis and business-case validation',
    focus: 'Feasibility & Capex Study',
    deliverables: [
      'Raw material availability & chemical analysis',
      'Mass and energy balance modeling',
      'Preliminary Capex/Opex assessment & ROI payback timeline'
    ]
  },
  {
    id: 'engineering',
    number: '02',
    title: 'ENGINEERING',
    subtitle: 'Basic & detailed process engineering',
    focus: 'Process & Spatial Design',
    deliverables: [
      'Basic Process Flow Diagrams (PFD) and P&IDs',
      '3D BIM plant layout and pipe routing models',
      'Equipment specifications & automation architecture'
    ]
  },
  {
    id: 'procurement',
    number: '03',
    title: 'PROCUREMENT',
    subtitle: 'Global equipment supply & quality audit',
    focus: 'Vendor Sourcing & Supply',
    deliverables: [
      'Vendor prequalification and factory acceptance testing (FAT)',
      'Specialized stainless steel vessel and column fabrication',
      'Logistics, customs clearance, and on-site delivery staging'
    ]
  },
  {
    id: 'construction',
    number: '04',
    title: 'CONSTRUCTION MANAGEMENT',
    subtitle: 'On-site erection & installation supervision',
    focus: 'Supervision & Safety',
    deliverables: [
      'Installation supervision of mechanical and electrical systems',
      'Piping networks, valve manifolds, and clean-in-place (CIP) loops',
      'Stringent site safety and construction compliance monitoring'
    ]
  },
  {
    id: 'commissioning',
    number: '05',
    title: 'COMMISSIONING',
    subtitle: 'Cold & hot commissioning and loop testing',
    focus: 'Testing & Calibration',
    deliverables: [
      'Hydrostatic testing and individual drive rotation checks',
      'Dry/cold commissioning and PLC/SCADA loop tuning',
      'Hot trial with actual plant raw materials and solvent loops'
    ]
  },
  {
    id: 'ramp-up',
    number: '06',
    title: 'RAMP-UP',
    subtitle: 'Capacity expansion and yield optimization',
    focus: 'Yield Optimization',
    deliverables: [
      'Gradual production ramp to 100% design throughput',
      'Optimization of extraction yields and energy efficiency',
      'Standard operating procedure (SOP) training for client staff'
    ]
  },
  {
    id: 'commercial',
    number: '07',
    title: 'COMMERCIAL OPERATION',
    subtitle: 'Stable production, warranty & ongoing support',
    focus: 'Full Operation & Warranty',
    deliverables: [
      'Official performance guarantee test run sign-off',
      'Transfer to full commercial operating protocol',
      'Preventive maintenance schedules, spare parts & ongoing technical audits'
    ]
  }
];

export const EpcmStages: React.FC<EpcmStagesProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const [activeStepModal, setActiveStepModal] = useState<StepItem | null>(null);

  return (
    <section id="epcm" className="w-full bg-[#F5F4EE] border-b border-[#16211B]/12 py-10 sm:py-12 lg:py-14">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-8 lg:gap-10">
          
          {/* Left Column: Title, Subtitle, and Action Button */}
          <div className="lg:w-[280px] xl:w-[300px] shrink-0 lg:border-e lg:border-[#16211B]/15 lg:pe-8 flex flex-col justify-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#111814] tracking-tight leading-[1.12] mb-2.5 font-tech uppercase">
              {withLineBreaks(t("FROM CONCEPT\nTO COMMERCIAL\nPRODUCTION"))}
            </h2>
            <p className="text-xs sm:text-[12.5px] text-[#46574D] leading-relaxed mb-5 max-w-[260px] font-normal">
              {t("Full-cycle EPC / EPCM solutions for industrial plants.")}
            </p>
            <div>
              <button
                onClick={() => onOpenProjectModal(t('EPC / EPCM Full-Cycle Solution'))}
                className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0E482C] text-white text-[10.5px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors rounded-none shadow-xs group cursor-pointer"
              >
                <span>{t("OUR EPC / EPCM APPROACH")}</span>
              </button>
            </div>
          </div>

          {/* Right Column: 7 Sequential Process Steps Connected by Arrows */}
          <div className="flex-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <div className="flex items-center justify-between min-w-[780px] xl:min-w-[840px] px-2">
              {EPCM_STEPS.map((step, idx) => (
                <React.Fragment key={step.id}>
                  {/* Step Item */}
                  <div
                    onClick={() => setActiveStepModal(step)}
                    className="flex flex-col items-center group cursor-pointer text-center px-1"
                  >
                    {/* Circular Icon Badge */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-[#16211B]/12 shadow-2xs flex items-center justify-center text-[#0E482C] group-hover:border-[#0E482C] group-hover:scale-105 group-hover:shadow-sm transition-all duration-300">
                      {idx === 0 && (
                        /* Step 1: Concept & Feasibility (Target/Compass/Lightbulb) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                        </svg>
                      )}
                      {idx === 1 && (
                        /* Step 2: Engineering (Blueprint/Plant Structure/Architecture) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="10" width="7" height="11" />
                          <rect x="14" y="4" width="7" height="17" />
                          <path d="M10 14h4M10 18h4M6 14v4M17 8v2M17 14v4" />
                        </svg>
                      )}
                      {idx === 2 && (
                        /* Step 3: Procurement (Shopping Cart / Supply) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="8" cy="21" r="1" />
                          <circle cx="19" cy="21" r="1" />
                          <path d="M2.5 2.5h3l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                        </svg>
                      )}
                      {idx === 3 && (
                        /* Step 4: Construction Management (Team / Workers / Supervision) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      )}
                      {idx === 4 && (
                        /* Step 5: Commissioning (Checklist / Quality Audit / Clipboard) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="3" width="16" height="18" rx="1" />
                          <path d="M9 3v3h6V3" />
                          <path d="m9 12 2 2 4-4" />
                          <path d="M9 18h6" />
                        </svg>
                      )}
                      {idx === 5 && (
                        /* Step 6: Ramp-Up (Performance Growth Chart) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                          <polyline points="16 7 22 7 22 13" />
                          <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" />
                          <circle cx="13.5" cy="15.5" r="1.5" fill="currentColor" />
                        </svg>
                      )}
                      {idx === 6 && (
                        /* Step 7: Commercial Operation (Operating Turnkey Factory) */
                        <svg className="w-6 h-6 stroke-current fill-none stroke-[1.6]" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 20h20" />
                          <path d="M5 20V8l5 4V8l5 4V4h4v16" />
                          <circle cx="17" cy="8" r="1" fill="currentColor" />
                          <circle cx="17" cy="12" r="1" fill="currentColor" />
                        </svg>
                      )}
                    </div>

                    {/* Step Title */}
                    <span className="font-tech text-[10px] sm:text-[10.5px] font-extrabold text-[#111814] tracking-wider uppercase leading-tight text-center max-w-[95px] mt-2.5 group-hover:text-[#0E482C] transition-colors">
                      {t(step.title)}
                    </span>
                  </div>

                  {/* Connecting Arrow between steps */}
                  {idx < EPCM_STEPS.length - 1 && (
                    <div className="shrink-0 text-[#8C9E93] opacity-60 flex items-center justify-center -mt-6">
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
      {activeStepModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveStepModal(null)}
        >
          <div
            className="relative w-full max-w-xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveStepModal(null)}
              className="absolute top-5 end-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label={t("Close modal")}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                {tr("EPCM STAGE {number}", { number: activeStepModal.number })}
              </span>
              <span className="text-[#A4B3A9]">/</span>
              <span className="font-tech text-xs text-[#B89758]">{t(activeStepModal.focus)}</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {t(activeStepModal.title)}
            </h3>
            <p className="text-xs sm:text-sm text-[#46574D] mb-6">
              {t(activeStepModal.subtitle)}
            </p>

            <div className="p-4 sm:p-5 bg-[#F5F3EC] border border-[#16211B]/10 mb-6">
              <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-3">
                {t("KEY DELIVERABLES & SCOPE")}
              </h4>
              <ul className="space-y-2 text-xs text-[#3E5045]">
                {activeStepModal.deliverables.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                    <span>{t(item)}</span>
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
                {t("CLOSE")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const stepName = activeStepModal.title;
                  setActiveStepModal(null);
                  onOpenProjectModal(t("EPCM Stage: {name}", { name: t(stepName) }));
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{t("CONSULT ON THIS STAGE")}</span>
                <ArrowRight className="w-4 h-4 text-[#D4B982]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
