import React, { useState } from 'react';
import { X, ArrowRight, BookOpen, Download, Calendar, Clock } from 'lucide-react';

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectModal: (topic?: string) => void;
}

const INSIGHTS_ARTICLES = [
  {
    id: 'alcohol-free-pectin-whitepaper',
    category: 'TECHNICAL WHITEPAPER',
    title: 'Alcohol-Free Hydro-Thermal Pectin Extraction: Yield, Energy, and Capex Optimization',
    date: 'SEPTEMBER 2024',
    readTime: '8 MIN READ',
    summary: 'A detailed comparative engineering paper contrasting traditional alcoholic precipitation versus multi-stage membrane diafiltration, demonstrating up to 34% reduction in operating thermal energy and near-zero VOC emissions.',
    tags: ['Pectin Engineering', 'Membrane Filtration', 'Capex/Opex Analysis']
  },
  {
    id: 'soy-isolate-trends-2025',
    category: 'INDUSTRY REPORT',
    title: 'Global Plant Protein Outlook: High-Purity Soy Protein Isolate (≥90%) Processing Trends',
    date: 'AUGUST 2024',
    readTime: '6 MIN READ',
    summary: 'Analysis of surging demand for neutral-flavor, high-solubility soy isolates in medical nutrition and plant-based formulations, and the critical role of continuous isoelectric separation in maintaining organoleptic quality.',
    tags: ['Soy Protein', 'Clean Label', 'Global Markets']
  },
  {
    id: 'inulin-diffusive-extraction',
    category: 'CASE STUDY',
    title: 'Jerusalem Artichoke Inulin Plants: Design Principles for Continuous Counter-Current Diffusion',
    date: 'JUNE 2024',
    readTime: '10 MIN READ',
    summary: 'Engineering layout and operational parameters for a 350 MT/day raw tuber processing line in Eastern Europe, achieving high fructan degree of polymerization (DP > 12) with minimal sugar degradation.',
    tags: ['Inulin Technology', 'Diffusion Systems', 'Prebiotics']
  }
];

export const InsightsModal: React.FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  onOpenProjectModal
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (title: string) => {
    setDownloadSuccess(title);
    setTimeout(() => setDownloadSuccess(null), 3500);
  };

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
            INSIGHTS & ENGINEERING KNOWLEDGE
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111814] tracking-tight mb-2 font-tech uppercase">
          Articles, Whitepapers & News
        </h2>
        <p className="text-sm text-[#46574D] mb-6 leading-relaxed">
          Access latest research papers, technology briefings, and processing benchmarks published by Soltex Global engineering specialists.
        </p>

        {downloadSuccess && (
          <div className="mb-6 p-3 bg-[#0E482C]/10 border border-[#0E482C]/30 text-xs text-[#0E482C] font-tech font-bold flex items-center justify-between">
            <span>✓ Technical brief for "{downloadSuccess}" generated and download started.</span>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {INSIGHTS_ARTICLES.map((art) => (
            <div
              key={art.id}
              className="p-5 bg-[#F5F3EC] border border-[#16211B]/10 hover:border-[#0E482C]/40 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 text-[11px] font-tech">
                <span className="font-extrabold text-[#0E482C] uppercase tracking-wider">
                  {art.category}
                </span>
                <span className="text-[#8C9E93]">•</span>
                <span className="text-[#55695E] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#B89758]" />
                  <span>{art.date}</span>
                </span>
                <span className="text-[#8C9E93]">•</span>
                <span className="text-[#55695E] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#B89758]" />
                  <span>{art.readTime}</span>
                </span>
              </div>

              <h3 className="font-tech text-sm sm:text-base font-extrabold text-[#111814] uppercase tracking-wide mb-2 leading-snug">
                {art.title}
              </h3>

              <p className="text-xs text-[#46574D] leading-relaxed mb-4">
                {art.summary}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#16211B]/10">
                <div className="flex flex-wrap gap-1.5">
                  {art.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-tech bg-white border border-[#16211B]/10 px-2 py-0.5 text-[#35483D]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownload(art.title)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-tech font-bold text-[#0E482C] uppercase tracking-wider hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Brief</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProjectModal(`Inquiry regarding: ${art.title}`);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-tech font-bold text-[#111814] uppercase tracking-wider hover:text-[#0E482C]"
                  >
                    <span>Discuss Topic →</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
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
