import React from 'react';
import { useParams } from 'react-router-dom';
import { Link } from '../i18n/Link';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Cpu, Factory, Beaker, Package, MapPin } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { PRODUCTS_DATA, ProductItem, TECHNOLOGIES_DATA, PROJECTS_DATA } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

export const ProductDetailPage: React.FC<{ onOpenProjectModal?: (topic?: string) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { slug } = useParams<{ slug: string }>();

  const prodIndex = PRODUCTS_DATA.findIndex((p) => p.slug === slug);
  const product: ProductItem | undefined = PRODUCTS_DATA[prodIndex];

  if (!product) {
    return (
      <div className="bg-[#FBFBF8] min-h-screen pt-36 pb-24 text-[#121815]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="text-xs font-mono uppercase text-[#0E482C] mb-4">{t("404 · Product Not Found")}</div>
          <h1 className="font-serif text-4xl mb-4">{t("Ingredient Dossier Unavailable")}</h1>
          <p className="text-[#334439] mb-8 font-light">
            {t("The requested commercial product specification could not be located in our verified product archives.")}
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors s-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("Return to Products Index")}</span>
          </Link>
        </div>
      </div>
    );
  }

  const prevProd = prodIndex > 0 ? PRODUCTS_DATA[prodIndex - 1] : PRODUCTS_DATA[PRODUCTS_DATA.length - 1];
  const nextProd = prodIndex < PRODUCTS_DATA.length - 1 ? PRODUCTS_DATA[prodIndex + 1] : PRODUCTS_DATA[0];

  const relatedTech = TECHNOLOGIES_DATA.find((t) => t.slug === product.relatedTechSlug);
  const relatedProject = PROJECTS_DATA.find((pr) => pr.slug === product.relatedProjectSlug);

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        badgeNumber={product.categoryNumber}
        badgeLabel={t("{category} · SPECIFICATION", { category: t(product.categoryTitle) })}
        title={t(product.title)}
        subtitle={t("Standardized Industrial Food & Pharma Grade Output")}
        description={t(product.description)}
        breadcrumbs={[
          { label: 'Products', href: '/products' },
          { label: product.title }
        ]}
        metaTags={[
          { label: 'Purity Standard', value: product.characteristics[0] || 'International Benchmark' },
          { label: 'Raw Feedstock', value: product.rawMaterials[0] || 'Natural Agro-Biomass' },
          { label: 'Applied Technology', value: product.productionTechnology },
          { label: 'Compliance Status', value: 'ISO 22000 / HACCP / GMP' }
        ]}
        primaryAction={{
          label: 'Request Certificate of Analysis (COA)',
          onClick: () => onOpenProjectModal?.(t("COA & Spec Sheet Request for {title}", { title: t(product.title) }))
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
                    src={product.image}
                    alt={t(product.title)}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  <div className="absolute bottom-4 start-4 end-4 flex items-center justify-between text-xs font-mono text-white">
                    <div className="flex items-center gap-2">
                      <Beaker className="w-4 h-4 text-[#BA9B60]" />
                      <span className="line-clamp-1">{t(product.productionTechnology)}</span>
                    </div>
                    <span className="text-[#BA9B60] uppercase font-semibold shrink-0">{t("Industrial Standard")}</span>
                  </div>
                </div>
              </ScrollReveal>

              {/* Functional Characteristics */}
              <ScrollReveal>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {t("01 · PHYSICAL & CHEMICAL CHARACTERISTICS")}
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    {t("Verified Chemical & Physical Profile")}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {product.characteristics.map((char, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#16211B]/10 p-5 flex items-start gap-3 hover:border-[#0E482C] transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5 text-[#0E482C] shrink-0 mt-0.5" />
                        <span className="text-sm text-[#223328] font-medium leading-snug">{t(char)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Commercial Applications & Usage */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {t("02 · SECTOR FORMULATIONS")}
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    {t("Target Formulations & Commercial Uses")}
                  </h2>

                  <div className="space-y-3">
                    {product.applications.map((app, idx) => (
                      <div key={idx} className="bg-white border border-[#16211B]/10 p-4 flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-[#0E482C] bg-beige-soft px-2.5 py-1 border border-taupe/50">
                          {tr("USE 0{n}", { n: idx + 1 })}
                        </span>
                        <span className="text-sm text-[#121815] font-medium">{t(app)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Manufacturing Provenance & Related Project */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10 space-y-6">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                    {t("03 · INDUSTRIAL PROVENANCE & PLANT REFERENCE")}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {relatedTech && (
                      <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-colors">
                        <div className="text-[10px] font-mono text-[#0E482C] uppercase font-bold mb-1">
                          {t("Licensed Technology Platform")}
                        </div>
                        <h4 className="font-serif text-lg font-bold text-[#121815] mb-2">
                          {t(relatedTech.title)}
                        </h4>
                        <p className="text-xs text-[#334439] mb-4 font-light line-clamp-2">
                          {t(relatedTech.subtitle)}
                        </p>
                        <Link
                          to={`/technologies/${relatedTech.slug}`}
                          className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span>{t("View Technology Dossier")}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}

                    {relatedProject && (
                      <div className="bg-white border border-[#16211B]/15 p-6 hover:border-[#0E482C] transition-colors">
                        <div className="text-[10px] font-mono text-[#0E482C] uppercase font-bold mb-1">
                          {t("Operational Industrial Facility")}
                        </div>
                        <h4 className="font-serif text-lg font-bold text-[#121815] mb-2">
                          {t(relatedProject.title)}
                        </h4>
                        <p className="text-xs text-[#334439] mb-4 font-light">
                          {t(relatedProject.country)} · {t(relatedProject.capacity)}
                        </p>
                        <Link
                          to={`/projects/${relatedProject.slug}`}
                          className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span>{t("View Plant Case Study")}</span>
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
                      <span>{t("Commercial Specification")}</span>
                    </div>

                    <div className="mt-4 space-y-3 divide-y divide-[#16211B]/10 text-xs font-mono">
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t("Feedstock Source")}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{product.rawMaterials.map((m) => t(m)).join(', ')}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t("Standard Packaging")}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{t("25 kg multi-wall craft bags / Big Bags (1,000 kg)")}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t("Shelf Life")}</div>
                        <div className="text-[#121815] font-bold mt-0.5">{t("24 Months from production date")}</div>
                      </div>
                      <div className="pt-2">
                        <div className="text-[#334439]/60 uppercase">{t("Regulatory Standards")}</div>
                        <div className="text-[#0E482C] font-bold mt-0.5">{t("FCC, USP, EP, ISO 22000, Halal, Kosher")}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#16211B]/10 space-y-3">
                    <button
                      onClick={() => onOpenProjectModal?.(t("Sample & Spec Request for {title}", { title: t(product.title) }))}
                      className="w-full py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors flex items-center justify-center gap-2 cursor-pointer s-btn"
                    >
                      <span>{t("Request Laboratory Sample")}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                    </button>

                    <Link
                      to="/products"
                      className="w-full py-3 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t("All Products Index")}</span>
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
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t("PREVIOUS PRODUCT")}</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{t(prevProd.title)}</div>
                <div className="text-xs font-mono text-[#334439]/80">{t(prevProd.categoryTitle)}</div>
              </div>
            </Link>

            <Link
              to={`/products/${nextProd.slug}`}
              className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center justify-between text-end"
            >
              <div>
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t("NEXT PRODUCT")}</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{t(nextProd.title)}</div>
                <div className="text-xs font-mono text-[#334439]/80">{t(nextProd.categoryTitle)}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={t("COMMERCIAL BULK CONTRACTS")}
        title={t("Discuss Manufacturing or Supply of {title}", { title: t(product.title) })}
        description={t("Whether engineering your own localized plant or purchasing bulk certified volumes, Soltex Global guarantees chemical consistency and supply chain reliability.")}
        topic={t("Product Inquiries for {title}", { title: t(product.title) })}
      />
    </div>
  );
};
