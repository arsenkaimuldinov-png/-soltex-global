import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';

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
  return (
    <section className="relative border-b border-[#16211B]/10 bg-[#FBFBF8] pt-32 pb-16 lg:pt-36 lg:pb-20 overflow-hidden">
      {/* Background Architectural Accent Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="max-w-[1400px] mx-auto h-full px-6 lg:px-12 grid grid-cols-4 lg:grid-cols-12">
          <div className="border-r border-[#16211B]/5 h-full col-span-1 hidden lg:block" />
          <div className="border-r border-[#16211B]/5 h-full col-span-3 lg:col-span-5" />
          <div className="border-r border-[#16211B]/5 h-full col-span-3 lg:col-span-4" />
          <div className="h-full col-span-2 hidden lg:block" />
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase text-[#334439]/70 mb-6">
            <Link to="/" className="hover:text-[#0E482C] transition-colors">HOME</Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-[#16211B]/30" />
                {crumb.href ? (
                  <Link to={crumb.href} className="hover:text-[#0E482C] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#0E482C] font-semibold">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Section Index Badge */}
        <div className="inline-flex items-center gap-3 border border-[#16211B]/15 bg-[#F3F3EC] px-3.5 py-1 text-[11px] font-mono tracking-widest text-[#0E482C] mb-6">
          <span className="font-bold">{badgeNumber}</span>
          <span className="w-1.5 h-1.5 bg-[#BA9B60] rounded-full" />
          <span className="font-semibold uppercase tracking-wider">{badgeLabel}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#121815] leading-[1.08] tracking-tight mb-4">
              {title}
            </h1>
            {subtitle && (
              <p className="font-serif italic text-lg sm:text-xl lg:text-2xl text-[#0E482C] mb-5">
                {subtitle}
              </p>
            )}
            {description && (
              <p className="text-base sm:text-lg text-[#334439] leading-relaxed max-w-3xl">
                {description}
              </p>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-end gap-5">
            {primaryAction && (
              primaryAction.href ? (
                <Link
                  to={primaryAction.href}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all duration-200 group border border-[#0E482C]"
                >
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <button
                  onClick={primaryAction.onClick}
                  className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all duration-200 group border border-[#0E482C] cursor-pointer"
                >
                  <span>{primaryAction.label}</span>
                  <ArrowRight className="w-4 h-4 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                </button>
              )
            )}

            {metaTags && metaTags.length > 0 && (
              <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-[#16211B]/10 lg:w-auto lg:min-w-[280px]">
                {metaTags.map((tag, idx) => (
                  <div key={idx} className="bg-[#F3F3EC] p-2.5 border border-[#16211B]/10">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70">{tag.label}</div>
                    <div className="text-xs font-bold text-[#121815] font-mono mt-0.5">{tag.value}</div>
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
