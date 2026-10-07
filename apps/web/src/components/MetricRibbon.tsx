import React from 'react';
import { withLineBreaks } from '../i18n/translate';
import { useContent } from '../content/useContent';
import { interpolateNodes } from '../content/getters';

/**
 * Stat band under the hero: a rule-separated strip of figures (Design Direction V1.0 §1).
 * No pictograms: the figure is the information (V1.0 §2 rejects circled line icons on stats).
 * Values and labels are content (`settings.metrics`); figures are never animated (no count-up).
 */
export const MetricRibbon: React.FC = () => {
  const { settings } = useContent();
  const metrics = settings.metrics;
  return (
    <div className="w-full bg-[#FAF9F5] border-y border-[#16211B]/12 py-5 sm:py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div data-reveal-group style={{ '--rv-d': '550ms' } as React.CSSProperties} className="grid grid-cols-2 lg:grid-cols-5 gap-y-5 lg:gap-y-0 lg:divide-x divide-[#16211B]/12">
          {metrics.map((metric, idx) => {
            const edge = idx === 0 ? 'lg:ps-0' : idx === metrics.length - 1 ? 'lg:pe-0' : '';
            const cell = ['flex flex-col justify-center lg:px-6 min-w-0', edge, idx === metrics.length - 1 && metrics.length % 2 === 1 ? 'col-span-2 lg:col-span-1' : '']
              .filter(Boolean)
              .join(' ');
            return metric.value !== null ? (
              <div key={metric.id} data-reveal="up" className={cell}>
                <span className="font-tech text-2xl sm:text-[28px] font-extrabold text-[#0E482C] tracking-tight leading-none mb-2 tabular-nums">
                  {metric.value}
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#46574D] uppercase tracking-wider leading-tight">
                  {withLineBreaks(metric.label)}
                </span>
              </div>
            ) : (
              <div key={metric.id} data-reveal="up" className={cell}>
                <span className="text-[11px] sm:text-xs font-extrabold text-[#111814] uppercase tracking-wider leading-snug">
                  {withLineBreaks(interpolateNodes(metric.label, {
                    highlight: <span className="text-[#0E482C]">{metric.highlight}</span>,
                  }))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
