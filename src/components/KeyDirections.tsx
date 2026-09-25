import React, { useState } from 'react';
import { ArrowRight, Leaf, Wheat, Flower2, Sprout, Factory, FlaskConical, X, CheckCircle2 } from 'lucide-react';
import { KEY_DIRECTIONS } from '../data/soltexData';
import { KeyDirection } from '../types';

interface KeyDirectionsProps {
  onSelectTechnology: (techTitle: string) => void;
}

export const KeyDirections: React.FC<KeyDirectionsProps> = ({ onSelectTechnology }) => {
  const [selectedTechModal, setSelectedTechModal] = useState<KeyDirection | null>(null);

  // Dedicated icons matching the 6 card directions from reference
  const getDirectionIcon = (id: string) => {
    switch (id) {
      case 'pectin':
        return <Leaf className="w-5 h-5 text-[#0E482C]" />;
      case 'soy-protein':
        return <Wheat className="w-5 h-5 text-[#B89758]" />;
      case 'inulin':
        return <Flower2 className="w-5 h-5 text-[#B89758]" />;
      case 'dietary-fibers':
        return <Sprout className="w-5 h-5 text-[#0E482C]" />;
      case 'integrated-solutions':
        return <Factory className="w-5 h-5 text-[#0E482C]" />;
      case 'functional-ingredients':
        return <FlaskConical className="w-5 h-5 text-[#B89758]" />;
      default:
        return <Sprout className="w-5 h-5 text-[#0E482C]" />;
    }
  };

  return (
    <section id="technologies" className="py-14 sm:py-18 lg:py-20 bg-[#FBFBF8] border-b border-[#16211B]/10">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header: Centered with subtle gold accent line matching Screenshot 2 */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#111814] tracking-wider uppercase font-tech">
            TECHNOLOGIES FOR HIGH-VALUE INGREDIENTS
          </h2>
          <div className="w-12 h-[2px] bg-[#B89758] mx-auto mt-2.5" aria-hidden="true" />
        </div>

        {/* 6-Column Card Grid (Desktop: 6 across, Tablet: 3, Mobile: 1 or 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-4.5 lg:gap-3.5 xl:gap-4">
          {KEY_DIRECTIONS.map((tech) => (
            <div
              key={tech.id}
              onClick={() => onSelectTechnology(tech.title)}
              className="group flex flex-col bg-[#F5F3EC] border border-[#16211B]/10 overflow-hidden hover:border-[#0E482C]/40 hover:shadow-md transition-all duration-300 cursor-pointer"
            >
              {/* Card Photo (Flush top with 4:3 aspect ratio) */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EAE7DE]">
                <img
                  src={tech.image}
                  alt={tech.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </div>

              {/* Card Content */}
              <div className="p-4 sm:p-4.5 flex flex-col flex-1 justify-between">
                <div>
                  {/* Technology Icon */}
                  <div className="mb-2.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    {getDirectionIcon(tech.id)}
                  </div>

                  {/* Technology Title */}
                  <h3 className="font-tech text-xs sm:text-[13px] font-extrabold text-[#111814] tracking-wider uppercase mb-1.5 leading-snug group-hover:text-[#0E482C] transition-colors">
                    {tech.title}
                  </h3>

                  {/* Subtitle / Sources */}
                  <p className="text-[11px] sm:text-[11.5px] text-[#4A5B51] leading-relaxed mb-4 min-h-[34px]">
                    {tech.subtitle}
                  </p>
                </div>

                {/* Card Action Link */}
                <div className="pt-2 border-t border-[#16211B]/8 flex items-center justify-between">
                  <span className="font-tech text-[10px] sm:text-[10.5px] font-bold text-[#111814] uppercase tracking-wider group-hover:text-[#0E482C] flex items-center gap-1.5 transition-colors">
                    <span>LEARN MORE</span>
                    <ArrowRight className="w-3 h-3 text-[#B89758] group-hover:translate-x-0.5 transition-transform" />
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTechModal(tech);
                    }}
                    className="text-[9.5px] font-tech text-[#5A6D62] hover:text-[#0E482C] uppercase underline underline-offset-2 ml-auto"
                    title="View Technical Specifications"
                  >
                    SPECS
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technical Specifications Quick Modal */}
      {selectedTechModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setSelectedTechModal(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedTechModal(null)}
              className="absolute top-5 right-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
              aria-label="Close details modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-2">
              <span className="w-2 h-2 bg-[#0E482C]" />
              <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
                TECHNICAL SPECIFICATIONS
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-[#111814] uppercase tracking-tight mb-2 font-tech">
              {selectedTechModal.title}
            </h3>
            <p className="text-sm text-[#46574D] mb-6">
              {selectedTechModal.description}
            </p>

            {/* Spec Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 p-5 bg-[#F5F3EC] border border-[#16211B]/10">
              {/* Raw Materials */}
              <div>
                <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-[#0E482C] mb-2">
                  RAW MATERIALS
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {selectedTechModal.rawMaterials.map((item, idx) => (
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
                  END PRODUCTS
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {selectedTechModal.endProducts.map((item, idx) => (
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
                  KEY FEATURES
                </h4>
                <ul className="space-y-1 text-xs text-[#3E5045]">
                  {selectedTechModal.technologyFeatures.map((item, idx) => (
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
                CLOSE
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = selectedTechModal.title;
                  setSelectedTechModal(null);
                  onSelectTechnology(title);
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>INQUIRE ABOUT THIS TECHNOLOGY</span>
                <ArrowRight className="w-4 h-4 text-[#B89758]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
