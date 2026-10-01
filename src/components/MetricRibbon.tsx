import React from 'react';
import { withLineBreaks } from '../i18n/translate';
import { useContent } from '../content/useContent';
import { interpolateNodes } from '../content/getters';

// Custom precision SVG icons matching the client reference screenshot
export const WreathIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Laurel left arc */}
    <path d="M12 34C8 28 8 18 13 12" />
    <path d="M8 29C5 29 5 26 8 25C11 24 11 26 8 29Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M8 22C5 22 5 19 8 18C11 17 11 19 8 22Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M10 15C7 15 8 12 11 12C13 12 13 14 10 15Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M14 9C12 9 13 6 16 7C18 8 18 10 14 9Z" fill="currentColor" fillOpacity="0.12" />

    {/* Laurel right arc */}
    <path d="M32 34C36 28 36 18 31 12" />
    <path d="M36 29C39 29 39 26 36 25C33 24 33 26 36 29Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M36 22C39 22 39 19 36 18C33 17 33 19 36 22Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M34 15C37 15 36 12 33 12C31 12 31 14 34 15Z" fill="currentColor" fillOpacity="0.12" />
    <path d="M30 9C32 9 31 6 28 7C26 8 26 10 30 9Z" fill="currentColor" fillOpacity="0.12" />

    {/* Center Medal Seal */}
    <circle cx="22" cy="22" r="7.5" strokeWidth="1.2" />
    <text
      x="22"
      y="25.5"
      textAnchor="middle"
      fontSize="8.5"
      fontFamily="'Plus Jakarta Sans', sans-serif"
      fontWeight="700"
      fill="currentColor"
      stroke="none"
    >
      25
    </text>
    {/* Bottom ribbon tie */}
    <path d="M18 36C20 38 24 38 26 36" />
  </svg>
);

export const GlobeGridIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="22" cy="22" r="14" />
    {/* Latitude lines */}
    <line x1="8" y1="22" x2="36" y2="22" />
    <path d="M10 15C14 18 30 18 34 15" />
    <path d="M10 29C14 26 30 26 34 29" />
    {/* Longitude lines */}
    <ellipse cx="22" cy="22" rx="7.5" ry="14" />
    <line x1="22" y1="8" x2="22" y2="36" />
  </svg>
);

export const CogEngineIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M22 9V6M22 38V35M35 22H38M6 22H9M31.2 12.8L33.3 10.7M10.7 33.3L12.8 31.2M31.2 31.2L33.3 33.3M10.7 10.7L12.8 12.8" />
    <circle cx="22" cy="22" r="10" />
    <circle cx="22" cy="22" r="4.5" />
    {/* Additional teeth contour matching reference gear */}
    <path d="M20 9.5H24L24.5 12H19.5L20 9.5Z" fill="currentColor" fillOpacity="0.1" />
    <path d="M20 34.5H24L24.5 32H19.5L20 34.5Z" fill="currentColor" fillOpacity="0.1" />
    <path d="M9.5 20V24L12 24.5V19.5L9.5 20Z" fill="currentColor" fillOpacity="0.1" />
    <path d="M34.5 20V24L32 24.5V19.5L34.5 20Z" fill="currentColor" fillOpacity="0.1" />
  </svg>
);

export const FactoryPlantIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Base ground line */}
    <line x1="6" y1="36" x2="38" y2="36" />
    {/* Tall distillation column */}
    <rect x="25" y="11" width="7" height="25" rx="1" />
    <line x1="25" y1="17" x2="32" y2="17" />
    <line x1="25" y1="23" x2="32" y2="23" />
    <line x1="25" y1="29" x2="32" y2="29" />
    {/* Distillation tower dome cap */}
    <path d="M25 11C25 8.5 32 8.5 32 11" />
    {/* Smaller secondary column / silo */}
    <rect x="33" y="18" width="5" height="18" rx="0.5" />
    {/* Factory sawtooth building with roof angles */}
    <path d="M7 36V26L13 22V26L19 22V26L25 22V36" />
    {/* Factory windows */}
    <rect x="9" y="29" width="3" height="4" fill="currentColor" fillOpacity="0.15" />
    <rect x="15" y="29" width="3" height="4" fill="currentColor" fillOpacity="0.15" />
    {/* Interconnecting pipe */}
    <path d="M20 18H25" />
  </svg>
);

export const ShieldBadgeCheckIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M22 7L33 11V21C33 28 28.5 34 22 37C15.5 34 11 28 11 21V11L22 7Z" />
    <path d="M17 21.5L20.5 25L27 18.5" strokeWidth="1.8" />
  </svg>
);

/** Icon per metric (presentation is code-owned; values and labels are content). */
const METRIC_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'metric-experience': WreathIcon,
  'metric-countries': GlobeGridIcon,
  'metric-technology': CogEngineIcon,
  'metric-projects': FactoryPlantIcon,
  'metric-epcm': ShieldBadgeCheckIcon,
};

export const MetricRibbon: React.FC = () => {
  const { settings } = useContent();
  const metrics = settings.metrics;
  return (
    <div className="w-full bg-[#FAF9F5] border-y border-[#16211B]/12 py-5 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div data-reveal-group style={{ '--rv-d': '550ms' } as React.CSSProperties} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-[#16211B]/12">
          {metrics.map((metric, idx) => {
            const Icon = METRIC_ICONS[metric.id] ?? ShieldBadgeCheckIcon;
            const edge = idx === 0 ? 'first:lg:ps-0' : idx === metrics.length - 1 ? 'last:lg:pe-0' : '';
            return metric.value !== null ? (
              <div key={metric.id} data-reveal="up" className={['flex items-center gap-3.5 sm:gap-4 py-3 sm:py-2 lg:px-5', edge].filter(Boolean).join(' ')}>
                <div className="text-[#0E482C] shrink-0">
                  <Icon className="w-10 h-10 sm:w-11 sm:h-11" />
                </div>
                <div className="flex flex-col">
                  <span className="font-tech text-xl sm:text-2xl font-extrabold text-[#111814] tracking-tight leading-none mb-1">
                    {metric.value}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#111814] uppercase tracking-wider leading-tight">
                    {withLineBreaks(metric.label)}
                  </span>
                </div>
              </div>
            ) : (
              <div key={metric.id} data-reveal="up" className={['flex items-center gap-3.5 sm:gap-4 py-3 sm:py-2 lg:px-5', edge].filter(Boolean).join(' ')}>
                <div className="text-[#0E482C] shrink-0">
                  <Icon className="w-10 h-10 sm:w-11 sm:h-11" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[11px] sm:text-xs font-extrabold text-[#111814] uppercase tracking-wider leading-tight">
                    {withLineBreaks(interpolateNodes(metric.label, {
                      highlight: <span className="text-[#0E482C]">{metric.highlight}</span>,
                    }))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
