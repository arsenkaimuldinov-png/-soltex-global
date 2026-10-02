import React from 'react';
import { X, ArrowRight, Utensils, Pill, Sparkles, Recycle } from 'lucide-react';

interface IndustriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIndustry: (industry: string) => void;
  initialIndustry?: string | null;
}

const INDUSTRIES_DATA = [
  {
    id: 'food-beverages',
    title: 'FOOD & BEVERAGES',
    icon: Utensils,
    description: 'Clean-label texturizers, gelling agents, functional dietary fibers, and plant protein isolates for bakery, dairy alternatives, confectionery, and beverages.',
    keyProducts: ['High & Low Methoxyl Pectins', 'Soy Protein Isolates (≥90%)', 'Soluble Dietary Fibers', 'Prebiotic Inulin Syrups']
  },
  {
    id: 'pharma-nutra',
    title: 'PHARMACEUTICALS & NUTRACEUTICALS',
    icon: Pill,
    description: 'High-purity therapeutic pectins, standardized prebiotic inulin fractions (FOS), and high-digestibility plant proteins complying with strict USP/EP pharmacopoeial standards.',
    keyProducts: ['Pharmaceutical-grade Pectin', 'Oligosaccharide Prebiotics', 'Nutraceutical Bioactive Carriers', 'Encapsulation Matrices']
  },
  {
    id: 'specialty-cosmetics',
    title: 'SPECIALTY INGREDIENTS & COSMETICS',
    icon: Sparkles,
    description: 'Natural biopolymers, natural film formers, hydrocolloid rheology modifiers, and bioactive botanical complexes for personal care and green cosmetics.',
    keyProducts: ['Cosmetic Botanical Extracts', 'Natural Hydrocolloids', 'Active Bioflavonoid Fractions', 'Skin-Conditioning Fibers']
  },
  {
    id: 'agro-waste',
    title: 'AGRO-WASTE & CIRCULAR VALORIZATION',
    icon: Recycle,
    description: 'Zero-discharge turnkey processing systems transforming agricultural processing by-products (apple pomace, citrus peels, beet pulp) into high-margin revenue streams.',
    keyProducts: ['Agro-Residue Extraction Lines', 'Distillery Grain Valorization', 'Technical Pectins & Fibers', 'Organic Bio-Nutrient Streams']
  }
];

export const IndustriesModal: React.FC<IndustriesModalProps> = ({
  isOpen,
  onClose,
  onSelectIndustry
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-[#0E482C]" />
          <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
            SECTORS & MARKET APPLICATIONS
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111814] tracking-tight mb-2 font-tech uppercase">
          Industries We Serve
        </h2>
        <p className="text-sm text-[#46574D] mb-8 max-w-2xl leading-relaxed">
          Soltex Global designs and constructs specialized processing plants tailored to the stringent regulatory, chemical, and purity requirements of leading global sectors.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {INDUSTRIES_DATA.map((ind) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.id}
                className="p-5 bg-[#F5F3EC] border border-[#16211B]/10 hover:border-[#0E482C]/40 transition-colors flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-2.5 text-[#0E482C]">
                    <Icon className="w-5 h-5" />
                    <h3 className="font-tech text-xs font-extrabold uppercase tracking-wider text-[#111814] group-hover:text-[#0E482C] transition-colors">
                      {ind.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[#4A5B51] leading-relaxed mb-4">
                    {ind.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {ind.keyProducts.map((p, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-tech font-semibold bg-white border border-[#16211B]/10 px-2 py-0.5 text-[#35483D]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectIndustry(ind.title);
                  }}
                  className="pt-2 border-t border-[#16211B]/10 flex items-center justify-between text-[11px] font-tech font-bold text-[#0E482C] uppercase tracking-wider group-hover:underline"
                >
                  <span>INQUIRE FOR THIS SECTOR</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B89758] group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 border-t border-[#16211B]/10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-[#16211B]/20 text-xs font-bold uppercase font-tech text-[#4A5B51] hover:bg-[#F3F3EC] transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
