import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { ArrowRight, CheckCircle2, ChevronRight, Layers, Sparkles, Beaker } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import type { Product as ProductItem } from '../content/types';
import { useI18n } from '../i18n/I18nProvider';

interface ProductsPageProps {
  onOpenProjectModal?: (topic?: InquiryTopic) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { header, c } = usePage('products');
  const { products } = useContent();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.products') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('products', 'inquiryTopic'))
        }}
      />

      {/* Editorial Product Index */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 mb-12 pb-4 border-b border-[#16211B]/10">
            <div className="text-xs font-mono uppercase tracking-widest text-[#334439]">
              {tr('products.count', { count: <span className="font-bold text-[#0E482C]">{products.length}</span> })}
            </div>
            <div className="text-[11px] font-mono text-[#334439]/60 uppercase">
              {c('listNote')}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((prod: ProductItem, i) => (
              <ScrollReveal key={prod.slug} index={i % 3}>
                <article
                  className="s-card group bg-white border border-[#16211B]/15 hover:border-[#0E482C] transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md h-full"
                >
                  {/* Large Product / Industrial Image Section */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#07130E] image-zoom-container">
                    <img
                      src={prod.image.src}
                      alt={prod.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                      loading="lazy"
                    />
                    <div className="s-overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Category Tag */}
                    <div className="absolute top-3 start-3 bg-[#07130E]/85 backdrop-blur-xs border border-white/20 px-2.5 py-1 text-[10px] font-mono tracking-wider text-[#BA9B60] uppercase font-semibold">
                      {prod.categoryNumber} · {prod.categoryTitle}
                    </div>

                    <div className="absolute bottom-3 start-3 end-3 text-white text-xs font-mono flex items-center justify-between">
                      <span className="text-white/80 line-clamp-1">{prod.rawMaterials[0]}</span>
                      <span className="text-[#BA9B60] font-bold">{t('products.standardGrade')}</span>
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="font-serif text-2xl text-[#121815] group-hover:text-[#0E482C] transition-colors mb-3">
                        <Link to={`/products/${prod.slug}`}>
                          {prod.title}
                        </Link>
                      </h2>

                      <p className="text-sm text-[#334439] leading-relaxed line-clamp-3 mb-5 font-light">
                        {prod.description}
                      </p>

                      {/* Applications preview */}
                      <div className="pt-4 border-t border-[#16211B]/10 mb-4">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-2 font-semibold">
                          {t('products.targetFormulations')}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {prod.applications.slice(0, 3).map((app, idx) => (
                            <span key={idx} className="bg-beige-soft px-2.5 py-1 text-[11px] font-mono text-[#223328] border border-taupe/50">
                              {app}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-4 border-t border-[#16211B]/10 flex items-center justify-between">
                      <Link
                        to={`/products/${prod.slug}`}
                        className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#0E482C] font-bold uppercase hover:text-[#07130E] group-hover:translate-x-1 transition-transform"
                      >
                        <span>{t('products.technicalSpecification')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                      </Link>

                      <span className="text-[10px] font-mono text-[#334439]/60 uppercase">
                        {t('products.coaAvailable')}
                      </span>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with simplified lead capture */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
