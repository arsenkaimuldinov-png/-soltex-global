import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2, Cpu, Factory, Layers, Sparkles, Beaker } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { TECHNOLOGIES_DATA, TechnologyItem, PROJECTS_DATA, PRODUCTS_DATA } from '../data/pagesData';

export const TechnologyDetailPage: React.FC<{ onOpenProjectModal?: (topic?: string) => void }> = ({ onOpenProjectModal }) => {
  const { slug } = useParams<{ slug: string }>();

  const techIndex = TECHNOLOGIES_DATA.findIndex((t) => t.slug === slug);
  const tech: TechnologyItem | undefined = TECHNOLOGIES_DATA[techIndex];

  if (!tech) {
    return (
      <div className="bg-[#FBFBF8] min-h-screen pt-36 pb-24 text-[#121815]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="text-xs font-mono uppercase text-[#0E482C] mb-4">404 · Technology Record Not Found</div>
          <h1 className="font-serif text-4xl mb-4">Process Technology Unavailable</h1>
          <p className="text-[#334439] mb-8 font-light">
            The requested technology dossier is not listed in our verified public registry.
          </p>
          <Link
            to="/technologies"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Technologies Index</span>
          </Link>
        </div>
      </div>
    );
  }

  const prevTech = techIndex > 0 ? TECHNOLOGIES_DATA[techIndex - 1] : TECHNOLOGIES_DATA[TECHNOLOGIES_DATA.length - 1];
  const nextTech = techIndex < TECHNOLOGIES_DATA.length - 1 ? TECHNOLOGIES_DATA[techIndex + 1] : TECHNOLOGIES_DATA[0];

  const relatedProjects = PROJECTS_DATA.filter((p) => tech.relatedProjects.includes(p.slug));
  const relatedProducts = PRODUCTS_DATA.filter((pr) => pr.relatedTechSlug === tech.slug);

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        badgeNumber={tech.categoryNumber}
        badgeLabel={`${tech.categoryTitle} · PROCESS SPECIFICATION`}
        title={tech.title}
        subtitle={tech.subtitle}
        description={tech.overview}
        breadcrumbs={[
          { label: 'Technologies', href: '/technologies' },
          { label: tech.title }
        ]}
        metaTags={[
          { label: 'Patent Protection', value: tech.patentInfo?.patentNumber || 'Proprietary Trade Secret' },
          { label: 'Process Efficiency', value: 'High Yield Recovery' },
          { label: 'Feedstock Base', value: tech.rawMaterials[0] || 'Plant Biomass' },
          { label: 'Technology Status', value: 'Commercially Operational' }
        ]}
        primaryAction={{
          label: 'Request Process Flowsheet',
          onClick: () => onOpenProjectModal?.(`Process Flowsheet Request: ${tech.title}`)
        }}
      />

      {/* Large Technical Hero Image */}
      <section className="bg-[#07130E] border-b border-[#16211B]/15 overflow-hidden">
        <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[380px] image-zoom-container">
          <img
            src={tech.image}
            alt={tech.title}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
            <div className="space-y-1">
              <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest font-semibold">
                BIOPROCESS EXTRACTION CORE
              </div>
              <div className="font-serif text-2xl sm:text-3xl text-[#FBFBF8]">
                {tech.title}
              </div>
            </div>
            {tech.patentInfo && (
              <div className="text-xs font-mono text-white/90 bg-black/50 px-3.5 py-1.5 border border-white/10 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#BA9B60]" />
                <span>{tech.patentInfo.patentNumber}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* Left Column: Technical Case Study Narrative */}
            <div className="lg:col-span-8 space-y-12">
              
              {/* Process Principles / Stages */}
              <ScrollReveal>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    01 · THERMODYNAMIC & CHEMICAL FLOW
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    Core Process Flowsheet Principles
                  </h2>

                  <div className="space-y-4">
                    {tech.processPrinciples.map((stage, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#16211B]/10 p-6 hover:border-[#0E482C] transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono font-bold text-[#0E482C] bg-[#F3F3EC] px-2 py-0.5 border border-[#16211B]/10">
                            STAGE 0{idx + 1}
                          </span>
                          <h3 className="font-serif text-lg font-bold text-[#121815]">
                            {stage.title}
                          </h3>
                        </div>
                        <p className="text-sm text-[#334439] leading-relaxed font-light pl-0 sm:pl-12">
                          {stage.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Equipment & Process Metallurgy Photo */}
              <ScrollReveal>
                <div className="border border-[#16211B]/15 bg-[#07130E] p-1 image-zoom-container relative">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <img
                      src="/images/tech_integrated_plant_1790271239031.jpg"
                      alt="Proprietary Separation Reactors and Vacuum Evaporators"
                      className="w-full h-full object-cover opacity-90"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-mono flex items-center justify-between">
                      <span className="text-white/90">AISI 316L Food-Grade Process Metallurgy</span>
                      <span className="text-[#BA9B60] uppercase">Patented Separation</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {/* Key Technical Advantages */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    02 · COMPARATIVE METRICS & ADVANTAGES
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    Engineering Advantages
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tech.keyAdvantages.map((adv, idx) => (
                      <div key={idx} className="bg-white border border-[#16211B]/10 p-5 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#0E482C] shrink-0 mt-0.5" />
                        <span className="text-sm text-[#223328] font-medium leading-relaxed">{adv}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* End-Market Applications */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    03 · COMMERCIAL VALUE & TARGET INDUSTRIES
                  </div>
                  <h2 className="font-serif text-3xl text-[#121815] mb-6">
                    Output Utilization Sectors
                  </h2>

                  <div className="flex flex-wrap gap-2.5">
                    {tech.applications.map((app, idx) => (
                      <span
                        key={idx}
                        className="bg-[#F3F3EC] border border-[#16211B]/15 px-4 py-2 text-xs font-mono uppercase text-[#121815]"
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Related Industrial Plants Built With This Tech */}
              {relatedProjects.length > 0 && (
                <ScrollReveal>
                  <div className="border-t border-[#16211B]/10 pt-10">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                      04 · INDUSTRIAL REFERENCE FACILITIES
                    </div>
                    <h2 className="font-serif text-3xl text-[#121815] mb-6">
                      Commercial Facilities Operating this Platform
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {relatedProjects.map((p) => (
                        <Link
                          key={p.slug}
                          to={`/projects/${p.slug}`}
                          className="group bg-white border border-[#16211B]/15 p-5 hover:border-[#0E482C] transition-colors"
                        >
                          <div className="aspect-[16/10] overflow-hidden bg-[#07130E] mb-4 image-zoom-container">
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          </div>
                          <div className="text-[10px] font-mono uppercase text-[#0E482C] font-semibold">{p.country} · {p.years}</div>
                          <h4 className="font-serif text-lg font-bold text-[#121815] group-hover:text-[#0E482C] transition-colors mt-1">{p.title}</h4>
                          <div className="text-xs font-mono text-[#334439]/70 mt-1">{p.capacity}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>

            {/* Right Column: Feedstock & Patent Specifications Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              <ScrollReveal delayMs={100}>
                <div className="bg-white border border-[#16211B]/15 p-6 lg:p-8 sticky top-28 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 pb-3 border-b border-[#16211B]/10 text-xs font-mono uppercase tracking-wider text-[#0E482C]">
                      <Beaker className="w-4 h-4 text-[#BA9B60]" />
                      <span>Raw Material Matrix</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {tech.rawMaterials.map((mat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-[#121815]">
                          <span className="w-1.5 h-1.5 bg-[#0E482C] rounded-full" />
                          <span>{mat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {tech.patentInfo && (
                    <div className="pt-4 border-t border-[#16211B]/10">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-1">
                        Registered Patent Number
                      </div>
                      <div className="font-mono text-sm font-bold text-[#0E482C]">
                        {tech.patentInfo.patentNumber}
                      </div>
                      <div className="text-xs text-[#334439] mt-1 font-light">
                        Jurisdiction: {tech.patentInfo.location}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-[#16211B]/10">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-2">
                      Direct High-Value Outputs
                    </div>
                    <div className="space-y-1.5">
                      {tech.productsProduced.map((prod, idx) => (
                        <div key={idx} className="text-xs font-mono text-[#223328] bg-[#F3F3EC] p-2 border border-[#16211B]/10">
                          {prod}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#16211B]/10 space-y-3">
                    <button
                      onClick={() => onOpenProjectModal?.(`Engineering Consultation for ${tech.title}`)}
                      className="w-full py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Request Process Flowsheet</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                    </button>

                    <Link
                      to="/technologies"
                      className="w-full py-3 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>All Technologies</span>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>

          </div>

          {/* Previous / Next Navigation */}
          <div className="mt-20 pt-10 border-t border-[#16211B]/15 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to={`/technologies/${prevTech.slug}`}
              className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center gap-4"
            >
              <ArrowLeft className="w-5 h-5 text-[#BA9B60] group-hover:-translate-x-1 transition-transform" />
              <div>
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">PREVIOUS TECHNOLOGY</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{prevTech.title}</div>
                <div className="text-xs font-mono text-[#334439]/80">{prevTech.categoryTitle}</div>
              </div>
            </Link>

            <Link
              to={`/technologies/${nextTech.slug}`}
              className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center justify-between text-right"
            >
              <div>
                <div className="text-[10px] font-mono uppercase text-[#334439]/60">NEXT TECHNOLOGY</div>
                <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{nextTech.title}</div>
                <div className="text-xs font-mono text-[#334439]/80">{nextTech.categoryTitle}</div>
              </div>
              <ArrowRight className="w-5 h-5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge="FEEDSTOCK ASSAY & FEASIBILITY"
        title={`Inquire About Licensing or Engineering ${tech.title}`}
        description="Soltex Global provides complete technology transfer packages, P&ID process schemes, proprietary reactor fabrication, and performance output guarantees."
        topic={`Technology Inquiry: ${tech.title}`}
      />
    </div>
  );
};
