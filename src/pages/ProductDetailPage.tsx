import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { useParams } from 'react-router-dom';
import { Link } from '../i18n/Link';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Cpu, Factory, Beaker, Package, MapPin } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import type { Product as ProductItem } from '../content/types';
import { useContent, usePage } from '../content/useContent';
import { useI18n } from '../i18n/I18nProvider';

export const ProductDetailPage: React.FC<{ onOpenProjectModal?: (topic?: InquiryTopic) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { c } = usePage('productDetail');
  const content = useContent();
  const products = content.products;
  const { slug } = useParams<{ slug: string }>();

  const prodIndex = products.findIndex((p) => p.slug === slug);
  const product: ProductItem | undefined = products[prodIndex];

  if (!product) {
    return (
      <div className="bg-[#FBFBF8] min-h-screen pt-36 pb-24 text-[#121815]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="text-xs font-mono uppercase text-[#0E482C] mb-4">{t('productDetail.notFoundEyebrow')}</div>
          <h1 className="font-serif text-4xl mb-4">{t('productDetail.notFoundTitle')}</h1>
          <p className="text-[#334439] mb-8 font-light">
            {t('productDetail.notFoundText')}
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors s-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('productDetail.backToIndex')}</span>
          </Link>
        </div>
      </div>
    );
  }

  const prevProd = prodIndex > 0 ? products[prodIndex - 1] : products[products.length - 1];
  const nextProd = prodIndex < products.length - 1 ? products[prodIndex + 1] : products[0];

  const relatedTech = content.technologyById(product.relatedTechnologyId);
  const relatedProject = content.projectById(product.relatedProjectId);

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        badgeNumber={product.categoryNumber}
        badgeLabel={c('badgeLabel', { category: product.categoryTitle })}
        title={product.title}
        subtitle={c('subtitle')}
        description={product.description}
        breadcrumbs={[
          { label: t('breadcrumb.products'), href: '/products' },
          { label: product.title }
        ]}
        metaTags={[
          { label: t('productDetail.metaPurity'), value: product.characteristics[0] || c('purityFallback') },
          { label: t('productDetail.metaFeedstock'), value: product.rawMaterials[0] || c('feedstockFallback') },
          { label: t('productDetail.metaTechnology'), value: product.productionTechnology },
          { label: t('productDetail.metaCompliance'), value: c('complianceValue') }
        ]}
        primaryAction={{
          label: c('headerActionLabel'),
          onClick: () => onOpenProjectModal?.(topicCopy('productDetail', 'headerInquiryTopic', { title: topicRef('product', product.id) }))
        }}
      />

      {/* Main Content */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* Left Column: Product Deep Dive & Storytelling */}
            <div className="lg:col-span-8 space-y-12">
              
              {/* Large Product Visual */}
              <ScrollReveal>
                <div className="relative aspect-[16/9] bg-[#07130E] overflow-hidden border border-[#16211B]/15 image-zoom-container">
                  <img
                    src={product.image.src}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  <div className="absolute bottom-4 start-4 end-4 flex items-center justify-between text-xs font-mono text-white">
                    <div className="flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-[#BA9B60]" />
                      <span className="line-clamp-1">{product.productionTechnology}</span>
                    </div>
                    <span className="text-[#BA9B60] uppercase font-semibold shrink-0">{c('imageTag')}</span>
                  </div>
                </div>
              </ScrollReveal>

              {/* Functional Characteristics */}
              <ScrollReveal>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {c('characteristicsEyebrow')}
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    {c('characteristicsHeading')}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {product.characteristics.map((char, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#16211B]/10 p-5 flex items-start gap-3 hover:border-[#0E482C] transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5 text-[#0E482C] shrink-0 mt-0.5" />
                        <span className="text-sm text-[#223328] font-medium leading-snug">{char}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Commercial Applications & Usage */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {c('applicationsEyebrow')}
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    {c('applicationsHeading')}
                  </h2>

                  <div className="space-y-3">
                    {product.applications.map((app, idx) => (
                      <div key={idx} className="bg-white border border-[#16211B]/10 p-4 flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-[#0E482C] bg-beige-soft px-2.5 py-1 border border-taupe/50">
                          {tr('productDetail.useNumber', { n: idx + 1 })}
                        </span>
                        <span className="text-sm text-[#121815] font-medium">{app}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Manufacturing Provenance & Related Project */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10 space-y-6">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                    {c('provenanceEyebrow')}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {relatedTech && (
                      <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-colors">
                        <div className="text-[10px] font-mono text-[#0E482C] uppercase font-bold mb-1">
                          {t('productDetail.licensedTechnology')}
                        </div>
                        <h4 className="font-serif text-lg font-bold text-[#121815] mb-2">
                          {relatedTech.title}
                        </h4>
                        <p className="text-xs text-[#334439] mb-4 font-light line-clamp-2">
                          {relatedTech.subtitle}
                        </p>
                        <Link
                          to={`/technologies/${relatedTech.slug}`}
                          className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span>{t('common.viewTechnologyDossier')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}

                    {relatedProject && (
                      <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-colors">
                        <div className="text-[10px] font-mono text-[#0E482C] uppercase font-bold mb-1">
                          {t('productDetail.operationalFacility')}
                        </div>
                        <h4 className="font-serif text-lg font-bold text-[#121815] mb-2">
                          {relatedProject.title}
                        </h4>
                        <p className="text-xs text-[#334439] mb-4 font-light">
                          {relatedProject.country} · {relatedProject.capacity}
                        </p>
                        <Link
                          to={`/projects/${relatedProject.slug}`}
                          className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span>{t('productDetail.viewCaseStudy')}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right Column: Specification Matrix Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              <ScrollReveal className="space-y-8" delayMs={100}>
                <div className="bg-white border border-[#16211B]/15 p-6 lg:p-8 sticky top-28 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 pb-3 border-b border-[#16211B]/10 text-xs font-mono uppercase tracking-wider text-[#0E482C]">
                      <Package className="w-4 h-4 text-[#BA9B60]" />
                      <span>{t('productDetail.commercialSpecification')}</span>
                    </div>

                    <div className="mt-4 space-y-3 divide-y divide-[#16211B]/10 text-xs font-mono">
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t('productDetail.feedstockSource')}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{product.rawMaterials.join(', ')}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t('productDetail.standardPackaging')}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{c('packagingValue')}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t('productDetail.shelfLife')}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{c('shelfLifeValue')}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t('productDetail.regulatoryStandards')}</div>
                        <div className="text-[#0E482C] font-bold mt-0.5">{c('regulatoryValue')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#16211B]/10 space-y-3">
                    <button
                      onClick={() => onOpenProjectModal?.(topicUi('productDetail.sampleTopic', { title: topicRef('product', product.id) }))}
                      className="w-full py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors flex items-center justify-center gap-2 cursor-pointer s-btn"
                    >
                      <span>{t('productDetail.requestSample')}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                    </button>

                    <Link
                      to="/products"
                      className="w-full py-3 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t('productDetail.allProducts')}</span>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Previous / Next Navigation */}
          <div className="mt-20 pt-10 border-t border-[#16211B]/15 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to={`/products/${prevProd.slug}`}
              className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center gap-4"
            >
              <ArrowLeft className="w-5 h-5 text-[#BA9B60] group-hover:-translate-x-1 transition-transform" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t('productDetail.previous')}</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{prevProd.title}</div>
                <div className="text-xs font-mono text-[#334439]/80">{prevProd.categoryTitle}</div>
              </div>
            </Link>

            <Link
              to={`/products/${nextProd.slug}`}
              className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center justify-between text-end"
            >
              <div>
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t('productDetail.next')}</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{nextProd.title}</div>
                <div className="text-xs font-mono text-[#334439]/80">{nextProd.categoryTitle}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle', { title: product.title })}
        description={c('ctaDescription')}
      />
    </div>
  );
};
