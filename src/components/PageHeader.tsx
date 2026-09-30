import React from 'react';
import { Link } from '../i18n/Link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  badgeNumber?: string;
  badgeLabel?: string;
  title: string;
  subtitle?: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  metaTags?: { label: string; value: string }[];
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badgeNumber = '01',
  badgeLabel = 'SECTION',
  title,
  subtitle,
  description,
  breadcrumbs,
  metaTags,
  primaryAction
}) => {
  const { t } = useI18n();
  return (
    <section data-motion="manual" className="relative border-b border-[#16211B]/10 bg-[#FBFBF8] pt-32 pb-16 lg:pt-36 lg:pb-20 overflow-hidden">
      {/* Background Architectural Accent Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="max-w-[1400px] mx-auto h-full px-6 lg:px-12 grid grid-cols-4 lg:grid-cols-12">
          <div className="s-seq-draw-y border-e border-[#16211B]/5 h-full col-span-1 hidden lg:block" style={{ '--seq': '0ms' } as React.CSSProperties} />
          <div className="s-seq-draw-y border-e border-[#16211B]/5 h-full col-span-3 lg:col-span-5" style={{ '--seq': '120ms' } as React.CSSProperties} />
          <div className="s-seq-draw-y border-e border-[#16211B]/5 h-full col-span-3 lg:col-span-4" style={{ '--seq': '240ms' } as React.CSSProperties} />
          <div className="h-full col-span-2 hidden lg:block" />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label={t("Breadcrumb")} style={{ '--seq': '60ms' } as React.CSSProperties} className="s-seq-fade flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase text-[#334439]/70 mb-6">
            <Link to="/" className="hover:text-[#0E482C] transition-colors">{t("HOME")}</Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-[#16211B]/30" />
                {crumb.href ? (
                  <Link to={crumb.href} className="hover:text-[#0E482C] transition-colors">
                    {t(crumb.label)}
                  </Link>
                ) : (
                  <span className="text-[#0E482C] font-semibold">{t(crumb.label)}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Section Index Badge */}
        <div className="flex items-center gap-4 mb-6">
          <div className="s-seq-rise inline-flex items-center gap-3 border border-taupe/70 bg-beige-soft px-3.5 py-1 text-[11px] font-mono tracking-widest text-[#0E482C]" style={{ '--seq': '140ms' } as React.CSSProperties}>
            <span className="font-bold">{t(badgeNumber)}</span>
            <span className="w-1.5 h-1.5 bg-[#BA9B60] rounded-full" />
            <span className="font-semibold uppercase tracking-wider">{t(badgeLabel)}</span>
          </div>
          {/* technical hairline drawn from the section index */}
          <span className="s-seq-draw hidden sm:block h-px w-16 lg:w-24 bg-taupe" style={{ '--seq': '300ms' } as React.CSSProperties} aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <h1 style={{ '--seq': '260ms' } as React.CSSProperties} className="s-seq-mask font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#121815] leading-[1.08] tracking-tight mb-4">
              {t(title)}
            </h1>
            {subtitle && (
              <p style={{ '--seq': '420ms' } as React.CSSProperties} className="s-seq-rise font-serif italic text-lg sm:text-xl lg:text-2xl text-[#0E482C] mb-5">
                {t(subtitle)}
              </p>
            )}
            {description && (
              <p style={{ '--seq': '520ms' } as React.CSSProperties} className="s-seq-rise text-base sm:text-lg text-[#334439] leading-relaxed max-w-3xl">
                {t(description)}
              </p>
            )}
          </div>

          <div style={{ '--seq': '620ms' } as React.CSSProperties} className="s-seq-rise lg:col-span-4 flex flex-col items-start lg:items-end justify-end gap-5">
            {primaryAction && (
              primaryAction.href ? (
                <Link
                  to={primaryAction.href}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all duration-200 group border border-[#0E482C] s-btn"
                >
                  <span>{t(primaryAction.label)}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <button
                  onClick={primaryAction.onClick}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all duration-200 group border border-[#0E482C] cursor-pointer s-btn"
                >
                  <span>{t(primaryAction.label)}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                </button>
              )
            )}

            {metaTags && metaTags.length > 0 && (
              <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-[#16211B]/10 lg:w-auto lg:min-w-[280px]">
                {metaTags.map((tag, idx) => (
                  <div key={idx} style={{ '--seq': `${720 + idx * 70}ms` } as React.CSSProperties} className="s-seq-rise bg-beige-soft/70 p-2.5 border border-taupe/45">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70">{t(tag.label)}</div>
                    <div className="text-xs font-bold text-[#121815] font-mono mt-0.5 break-words">
                      {/* e-mail values may wrap after "@" instead of overflowing narrow cells */}
                      {t(tag.value).split('@').map((part, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <>@<wbr /></>}
                          {part}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
