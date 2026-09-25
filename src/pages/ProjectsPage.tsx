import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Calendar, Gauge, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { PROJECTS_DATA, ProjectItem } from '../data/pagesData';

interface ProjectsPageProps {
  onOpenProjectModal?: (topic?: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onOpenProjectModal }) => {
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Page Header */}
      <PageHeader
        badgeNumber="05"
        badgeLabel="INDUSTRIAL TRACK RECORD"
        title="Industrial Projects & Turnkey Facilities"
        subtitle="30+ Years of International EPC Project Delivery"
        description="Factual overview of completed and operational industrial plants delivered across Israel, China, Uzbekistan, and Eurasia. Every project reflects certified engineering, patented extraction protocols, and verified operational capacities."
        breadcrumbs={[
          { label: 'Projects' }
        ]}
        metaTags={[
          { label: 'Total Track Record', value: '30+ Years' },
          { label: 'Delivery Model', value: 'Turnkey EPC / EPCM' },
          { label: 'Verified Geography', value: 'Asia, Middle East, CIS' },
          { label: 'Flagship Scale', value: '17,000 t/y Isolate' }
        ]}
        primaryAction={{
          label: 'Submit Plant Inquiry',
          onClick: () => onOpenProjectModal?.('New Turnkey Project Inquiry')
        }}
      />

      {/* International Engineering Portfolio Grid */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between mb-12 pb-4 border-b border-[#16211B]/10">
            <div className="text-xs font-mono uppercase tracking-widest text-[#334439]">
              SHOWING <span className="font-bold text-[#0E482C]">{PROJECTS_DATA.length}</span> VERIFIED INDUSTRIAL PLANTS
            </div>
            <div className="text-[11px] font-mono text-[#334439]/60 uppercase">
              SORTED BY HISTORICAL CHRONOLOGY & SCALE
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {PROJECTS_DATA.map((project: ProjectItem) => (
              <ScrollReveal key={project.slug}>
                <article
                  className="group bg-white border border-[#16211B]/15 hover:border-[#0E482C] transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-lg h-full"
                >
                  {/* Large Project Image Section with Subtle Scale */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#07130E] image-zoom-container">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    
                    {/* Category badge */}
                    <div className="absolute top-3 left-3 bg-[#07130E]/85 backdrop-blur-xs border border-white/20 px-2.5 py-1 text-[10px] font-mono tracking-wider text-[#BA9B60] uppercase font-semibold">
                      {project.category}
                    </div>

                    {/* Location badge */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white text-xs font-mono">
                      <MapPin className="w-3.5 h-3.5 text-[#BA9B60]" />
                      <span className="font-semibold">{project.country}</span>
                      <span className="text-white/60">· {project.years}</span>
                    </div>

                    {project.capacity && (
                      <div className="absolute bottom-3 right-3 bg-[#0E482C] px-2.5 py-0.5 text-[10px] font-mono tracking-wider text-white font-bold">
                        {project.capacity}
                      </div>
                    )}
                  </div>

                  {/* Content Section with Clear Hierarchy */}
                  <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-[#0E482C] tracking-widest uppercase mb-1 font-semibold">
                        {project.categoryNumber} · {project.type}
                      </div>

                      <h2 className="font-serif text-2xl text-[#121815] group-hover:text-[#0E482C] transition-colors mb-3">
                        <Link to={`/projects/${project.slug}`}>
                          {project.title}
                        </Link>
                      </h2>

                      <p className="text-sm text-[#334439] leading-relaxed line-clamp-3 mb-5 font-light">
                        {project.overview}
                      </p>

                      {/* Scope bullets preview */}
                      <div className="space-y-1.5 mb-6 pt-4 border-t border-[#16211B]/10">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#334439]/70 mb-2 font-semibold">
                          Core Engineering Scope:
                        </div>
                        {project.scope.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-[#223328]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0E482C] mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer with Arrow Animation */}
                    <div className="pt-4 border-t border-[#16211B]/10 flex items-center justify-between">
                      <Link
                        to={`/projects/${project.slug}`}
                        className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#0E482C] font-bold uppercase hover:text-[#07130E] group-hover:translate-x-1 transition-transform"
                      >
                        <span>Explore Case Study</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
                      </Link>

                      <span className="text-[10px] font-mono text-[#334439]/50 uppercase">
                        Turnkey EPC
                      </span>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Global Project Capability Summary Banner */}
      <section className="bg-[#F3F3EC] border-y border-[#16211B]/10 py-16">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <ScrollReveal delayMs={50}>
              <div className="border-l-2 border-[#0E482C] pl-5">
                <div className="text-3xl font-serif text-[#121815] font-bold">17,000 t/y</div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#334439] mt-1 font-semibold">Largest Soy Isolate Line</div>
                <div className="text-xs text-[#334439]/70 mt-1 font-light">Constructed in Ashdod, Israel</div>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="border-l-2 border-[#0E482C] pl-5">
                <div className="text-3xl font-serif text-[#121815] font-bold">1,000 t/y</div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#334439] mt-1 font-semibold">Pectin Capacity Delivered</div>
                <div className="text-xs text-[#334439]/70 mt-1 font-light">Apple pectin plant in Namangan</div>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={150}>
              <div className="border-l-2 border-[#0E482C] pl-5">
                <div className="text-3xl font-serif text-[#121815] font-bold">18+ Years</div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#334439] mt-1 font-semibold">Continuous Plant Operation</div>
                <div className="text-xs text-[#334439]/70 mt-1 font-light">Proof of enduring engineering durability</div>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={200}>
              <div className="border-l-2 border-[#BA9B60] pl-5">
                <div className="text-3xl font-serif text-[#121815] font-bold">100% Turnkey</div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#334439] mt-1 font-semibold">From Lab to Commercial Run</div>
                <div className="text-xs text-[#334439]/70 mt-1 font-light">Guaranteed product output specifications</div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section with simplified lead capture */}
      <CtaSection
        badge="PROJECT FEASIBILITY & CONSULTATION"
        title="Planning a Plant Construction or Modernization?"
        description="Share your feedstock parameters, target annual capacity, and preferred site geography with Soltex Global EPC engineers for a comprehensive technology audit."
        topic="Project Inquiry from Projects Index"
      />
    </div>
  );
};
