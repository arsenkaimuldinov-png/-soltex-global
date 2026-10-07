import React, { useState } from 'react';
import { topicRef, type TopicRef } from '../services/leads/topics';
import { ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { usePage } from '../content/useContent';
import type { MediaAsset } from '../content/types';
import { useI18n } from '../i18n/I18nProvider';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../motion/usePresence';
import { Link } from '../i18n/Link';

/** A technology direction card of the home page (content list `home.keyDirections`). */
interface KeyDirection {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  image: MediaAsset;
  href: string;
  rawMaterials: string[];
  endProducts: string[];
  technologyFeatures: string[];
}

interface KeyDirectionsProps {
  /** Opens the project inquiry form preset to a technology (used by the SPECS dialog). */
  onSelectTechnology: (topic: TopicRef) => void;
}

export const KeyDirections: React.FC<KeyDirectionsProps> = ({ onSelectTechnology }) => {
  const { t } = useI18n();
  const { c, list } = usePage('home');
  const directions = list<KeyDirection>('keyDirections');
  const [selectedTechModal, setSelectedTechModal] = useState<KeyDirection | null>(null);
  const closeTechModal = React.useCallback(() => setSelectedTechModal(null), []);
  useDialog(!!selectedTechModal, closeTechModal);
  const techModalPresence = usePresence(selectedTechModal, 220);
  const techModal = techModalPresence.item;

  return (
    <section id="technologies" className="py-14 sm:py-18 lg:py-20 bg-[#FBFBF8] border-b border-[#16211B]/10">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header: start-aligned on the grid (Design Direction V1.0 §2: no centred band headings) */}
        <div className="mb-10 sm:mb-12">
          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#111814] tracking-wider uppercase font-tech">
            {c('technologiesHeading')}
          </h2>
          <div data-reveal="line" className="w-12 h-[2px] bg-[#B89758] mt-2.5" aria-hidden="true" />
        </div>

        {/* 6-Column Card Grid (Desktop: 6 across, Tablet: 3, Mobile: 1 or 2) */}
        <div data-reveal-group className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-4.5 lg:gap-3.5 xl:gap-4">
          {directions.map((tech, idx) => (
            <div
              key={tech.id}
              data-reveal="up"
              style={{ '--rv-i': idx } as React.CSSProperties}
              className="s-card group relative flex flex-col bg-[#F5F3EC] border border-[#16211B]/10 overflow-hidden hover:border-[#0E482C]/40 transition-colors duration-300 cursor-pointer"
            >
              {/* Card Photo (Flush top with 4:3 aspect ratio) */}
              <div data-reveal="image" style={{ '--rv-i': idx } as React.CSSProperties} className="relative aspect-[4/3] w-full overflow-hidden bg-[#EAE7DE]">
                <img loading="lazy" decoding="async"
                  src={tech.image.src}
                  alt={tech.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </div>

              {/* Card Content */}
              <div className="p-4 sm:p-4.5 flex flex-col flex-1 justify-between">
                <div>
                  {/* Index number (no botanical pictograms: the leaf lives only in the logo, V1.0 §3) */}
                  <span className="block font-tech text-[10.5px] font-bold text-[#997A3E] tracking-wider tabular-nums mb-2" aria-hidden="true">
                    {tech.number}
                  </span>

                  {/* Technology Title */}
                  <h3 className="font-tech text-xs sm:text-[13px] font-extrabold text-[#111814] tracking-wider uppercase mb-1.5 leading-snug group-hover:text-[#0E482C] transition-colors">
                    {/* Stretched link: the whole card opens the technology page; SPECS stays a separate button */}
                    <Link
                      to={tech.href}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[#0E482C]"
                    >
                      {tech.title}
                    </Link>
                  </h3>

                  {/* Subtitle / Sources */}
                  <p className="text-[11px] sm:text-[11.5px] text-[#4A5B51] leading-relaxed mb-4 min-h-[34px]">
                    {tech.subtitle}
                  </p>
                </div>

                {/* Card Action Link */}
                <div className="pt-2 border-t border-[#16211B]/8 flex items-center justify-between">
                  <span className="s-meta font-tech text-[10px] sm:text-[10.5px] font-bold text-[#111814] uppercase tracking-wider group-hover:text-[#0E482C] flex items-center gap-1.5 whitespace-nowrap transition-colors">
                    <span>{t('keyDirections.learnMore')}</span>
                    <ArrowRight className="w-3 h-3 text-[#B89758] group-hover:translate-x-0.5 transition-transform" />
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTechModal(tech);
                    }}
                    className="relative z-10 -my-2 py-2 ps-3 text-[9.5px] font-tech text-[#5A6D62] hover:text-[#0E482C] uppercase underline underline-offset-2 ms-auto"
                    title={t('keyDirections.viewSpecsTitle')}
                  >
                    {t('keyDirections.specs')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical Specifications Quick Modal */}
      {techModal && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs s-backdrop ${techModalPresence.exiting ? 'is-exiting' : ''}`}
          onClick={() => setSelectedTechModal(null)}
        >
          <div
            className="s-panel relative w-full max-w-2xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedTechModal(null)}
              className="absolute top-5 end-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label={t('keyDirections.closeDetails')}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-[#0E482C]" />
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                {t('keyDirections.technicalSpecifications')}
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {techModal.title}
            </h3>
            <p className="text-sm text-[#46574D] mb-6">
              {techModal.description}
            </p>

            {/* Spec Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 p-5 bg-[#F5F3EC] border border-[#16211B]/10">
              {/* Raw Materials */}
              <div>
                <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-2">
                  {t('keyDirections.rawMaterials')}
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {techModal.rawMaterials.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#B89758]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* End Products */}
              <div>
                <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-2">
                  {t('keyDirections.endProducts')}
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {techModal.endProducts.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#0E482C]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Engineering Features */}
              <div>
                <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-2">
                  {t('keyDirections.keyFeatures')}
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {techModal.technologyFeatures.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#16211B]/10">
              <button
                type="button"
                onClick={() => setSelectedTechModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 border border-[#16211B]/20 text-xs font-bold uppercase font-tech text-[#4A5B51] hover:bg-[#F3F3EC] transition-colors"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = techModal.id;
                  setSelectedTechModal(null);
                  onSelectTechnology(topicRef('keyDirection', id));
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs s-btn"
              >
                <span>{t('keyDirections.inquire')}</span>
                <ArrowRight className="w-4 h-4 text-[#B89758]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
