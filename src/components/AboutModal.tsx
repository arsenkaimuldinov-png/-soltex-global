import React from 'react';
import { X, CheckCircle2, ArrowRight, ShieldCheck, Award, Globe2, Building2 } from 'lucide-react';
import { SoltexLogo } from './SoltexLogo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectModal: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenProjectModal
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
        className="relative w-full max-w-3xl bg-[#FBFBF8] border border-[#16211B]/20 shadow-2xl p-6 sm:p-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#46574D] hover:text-[#111814] hover:bg-[#F3F3EC] transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Eyebrow */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-[#0E482C]" />
          <span className="font-tech text-xs font-bold text-[#0E482C] uppercase tracking-wider">
            ABOUT SOLTEX GLOBAL
          </span>
        </div>

        <div className="mb-6">
          <SoltexLogo size="md" variant="dark" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111814] tracking-tight mb-4 font-tech uppercase">
          International EPC / EPCM Engineering Group
        </h2>

        <p className="text-sm sm:text-base text-[#46574D] leading-relaxed mb-6">
          Soltex Global is a technology-focused engineering and construction management group specializing in high-value ingredient processing facilities. We combine proprietary extraction technologies with complete turnkey project delivery, spanning feasibility, process engineering, specialized equipment fabrication, construction supervision, commissioning, and operational ramp-up.
        </p>

        {/* 4 Pillar Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-[#F5F3EC] border border-[#16211B]/10">
            <div className="flex items-center gap-2.5 mb-2 text-[#0E482C]">
              <Globe2 className="w-5 h-5" />
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-[#111814]">
                Global Execution Presence
              </h3>
            </div>
            <p className="text-xs text-[#4A5B51] leading-relaxed">
              Headquartered in Dubai, UAE, with process engineering and equipment fabrication hubs across Europe and Central Asia delivering plants in 10+ countries.
            </p>
          </div>

          <div className="p-4 bg-[#F5F3EC] border border-[#16211B]/10">
            <div className="flex items-center gap-2.5 mb-2 text-[#0E482C]">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-[#111814]">
                Alcohol-Free IP Technologies
              </h3>
            </div>
            <p className="text-xs text-[#4A5B51] leading-relaxed">
              Patented industrial extraction methods yielding ultra-pure pectin, soy protein isolates, and inulin with minimal chemical footprints and low energy demand.
            </p>
          </div>

          <div className="p-4 bg-[#F5F3EC] border border-[#16211B]/10">
            <div className="flex items-center gap-2.5 mb-2 text-[#0E482C]">
              <Building2 className="w-5 h-5" />
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-[#111814]">
                End-to-End EPCM Delivery
              </h3>
            </div>
            <p className="text-xs text-[#4A5B51] leading-relaxed">
              From raw material biochemical validation and mass balances to 3D BIM modeling, vendor FAT audits, cold/hot commissioning, and throughput guarantees.
            </p>
          </div>

          <div className="p-4 bg-[#F5F3EC] border border-[#16211B]/10">
            <div className="flex items-center gap-2.5 mb-2 text-[#0E482C]">
              <Award className="w-5 h-5" />
              <h3 className="font-tech text-xs font-bold uppercase tracking-wider text-[#111814]">
                Guaranteed Plant Performance
              </h3>
            </div>
            <p className="text-xs text-[#4A5B51] leading-relaxed">
              Over $300M+ USD in plant projects commissioned, backing every engineering package with strict throughput, yield, and purity contractual milestones.
            </p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#16211B]/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 border border-[#16211B]/20 text-xs font-bold uppercase font-tech text-[#4A5B51] hover:bg-[#F3F3EC] transition-colors"
          >
            CLOSE
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenProjectModal();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-[#0E482C] text-white text-xs font-bold uppercase font-tech tracking-wider hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <span>START YOUR PROJECT</span>
            <ArrowRight className="w-4 h-4 text-[#D4B982]" />
          </button>
        </div>
      </div>
    </div>
  );
};
