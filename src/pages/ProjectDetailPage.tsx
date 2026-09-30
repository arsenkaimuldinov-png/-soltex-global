import React from 'react';
import { useParams } from 'react-router-dom';
import { Link } from '../i18n/Link';
import { ArrowLeft, ArrowRight, MapPin, Calendar, CheckCircle2, ShieldCheck, Cpu, Building2, Layers } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { PROJECTS_DATA, ProjectItem, TECHNOLOGIES_DATA } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

export const ProjectDetailPage: React.FC<{ onOpenProjectModal?: (topic?: string) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { slug } = useParams<{ slug: string }>();

  const projectIndex = PROJECTS_DATA.findIndex((p) => p.slug === slug);
  const project: ProjectItem | undefined = PROJECTS_DATA[projectIndex];

  if (!project) {
    return (
      <div className="bg-[#FBFBF8] min-h-screen pt-36 pb-24 text-[#121815]">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="text-xs font-mono uppercase text-[#0E482C] mb-4">{t("404 · Project Not Found")}</div>
          <h1 className="font-serif text-4xl mb-4">{t("Project Case Study Unavailable")}</h1>
          <p className="text-[#334439] mb-8 font-light">
            {t("The requested industrial facility record could not be found in our verified project archives.")}
          </p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors s-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t("Return to Projects Index")}</span>
          </Link>
        </div>
      </div>
    );
  }

  const prevProject = projectIndex > 0 ? PROJECTS_DATA[projectIndex - 1] : PROJECTS_DATA[PROJECTS_DATA.length - 1];
  const nextProject = projectIndex < PROJECTS_DATA.length - 1 ? PROJECTS_DATA[projectIndex + 1] : PROJECTS_DATA[0];

  const relatedTech = TECHNOLOGIES_DATA.find((t) => t.slug === project.relatedTechSlug);

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* 1. HERO & PAGE HEADER */}
      <PageHeader
        badgeNumber={project.categoryNumber}
        badgeLabel={t("{category} · CASE STUDY", { category: t(project.category) })}
        title={t(project.title)}
        subtitle={`${t(project.type)} — ${t(project.country)}`}
        description={t(project.overview)}
        breadcrumbs={[
          { label: 'Projects', href: '/projects' },
          { label: project.title }
        ]}
        metaTags={[
          { label: 'Country / Geography', value: project.country },
          { label: 'Project Years', value: project.years },
          { label: 'Installed Capacity', value: project.capacity || 'Custom Industrial' },
          { label: 'Contract Scope', value: 'Turnkey EPC / EPCM' }
        ]}
        primaryAction={{
          label: 'Request Similar Facility Audit',
          onClick: () => onOpenProjectModal?.(t("Inquiry for project model: {title}", { title: t(project.title) }))
        }}
      />

      {/* 2. LARGE HERO IMAGE */}
      <section className="bg-[#07130E] border-b border-[#16211B]/15 overflow-hidden">
        <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[380px] image-zoom-container">
          <img
            src={project.image}
            alt={t(project.title)}
            className="w-full h-full object-cover opacity-90"
            style={project.imagePosition ? { objectPosition: project.imagePosition } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto flex flex-wrap items-end justify-between gap-4 text-white">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-white/90">
                <MapPin className="w-4 h-4 text-[#BA9B60]" />
                {t(project.country)}
              </span>
              <span className="text-white/40">|</span>
              <span className="flex items-center gap-1.5 text-white/90">
                <Calendar className="w-4 h-4 text-[#BA9B60]" />
                {t(project.years)}
              </span>
            </div>
            {project.capacity && (
              <div className="text-[#BA9B60] text-sm font-mono font-bold bg-black/50 px-3.5 py-1.5 border border-white/10">
                {tr("ANNUAL OUTPUT: {capacity}", { capacity: t(project.capacity) })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. PROJECT INFORMATION & OVERVIEW */}
      <section className="py-16 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            <div className="lg:col-span-8 space-y-10">
              <ScrollReveal className="space-y-10">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                    {t("01 · INDUSTRIAL IMPLEMENTATION CONTEXT")}
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl text-[#121815] mb-6">
                    {t("Commercial Mandate & Engineering Background")}
                  </h2>
                  <div className="prose prose-stone text-base sm:text-lg text-[#334439] leading-relaxed space-y-4 font-light">
                    <p>{t(project.overview)}</p>
                    <p>
                      {t("Constructed in strict accordance with Soltex Global’s proprietary process parameters, combining energy-efficient thermodynamic flow balances, continuous automated separation, and cleanroom stainless-steel pipeline routing.")}
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              {/* 4. TECHNOLOGY SECTION */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                    {t("02 · INTEGRATED PROCESS TECHNOLOGY")}
                  </div>
                  <h3 className="font-serif text-2xl text-[#121815] mb-4">
                    {tr("Applied Process: {technology}", { technology: t(project.technology) })}
                  </h3>
                  <p className="text-sm text-[#334439] leading-relaxed font-light mb-6">
                    {t("This installation operates under proprietary separation thermodynamics that maximize target active yield while preventing product discoloration and protein denaturation.")}
                  </p>

                  <div className="bg-[#F3F3EC] p-5 border border-[#16211B]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="text-xs font-mono text-[#334439]">
                      <span className="font-bold text-[#0E482C] block mb-0.5">{t("PATENT & IP CERTIFICATION")}</span>
                      <span>{t("Verified commercial implementation of Soltex process platform")}</span>
                    </div>
                    {relatedTech && (
                      <Link
                        to={`/technologies/${relatedTech.slug}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E482C] text-white text-xs font-mono uppercase tracking-wider hover:bg-[#07130E] transition-colors shrink-0 s-btn"
                      >
                        <span>{t("View Technology Dossier")}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                      </Link>
                    )}
                  </div>
                </div>
              </ScrollReveal>

              {/* 5. ENGINEERING / EPCM SCOPE */}
              <ScrollReveal>
                <div className="border-t border-[#16211B]/10 pt-10">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                    {t("03 · TURNKEY EPCM RESPONSIBILITY")}
                  </div>
                  <h3 className="font-serif text-2xl text-[#121815] mb-6">
                    {t("Scope of Delivery & Work Completed")}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.scope.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#16211B]/10 p-5 flex items-start gap-4 hover:border-[#0E482C] transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#0E482C]/10 text-[#0E482C] flex items-center justify-center shrink-0 text-xs font-mono font-bold">
                          {idx + 1}
                        </div>
                        <div className="text-sm text-[#223328] font-medium leading-snug">
                          {t(item)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              {/* Verified Results */}
              {project.results && project.results.length > 0 && (
                <ScrollReveal>
                  <div className="border-t border-[#16211B]/10 pt-10">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                      {t("04 · PERFORMANCE GUARANTEES")}
                    </div>
                    <h3 className="font-serif text-2xl text-[#121815] mb-6">
                      {t("Commercial Output & Performance Validation")}
                    </h3>

                    <div className="bg-beige-soft border border-taupe/50 p-6 lg:p-8 space-y-4">
                      {project.results.map((res, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-[#0E482C] shrink-0 mt-0.5" />
                          <span className="text-base text-[#121815] font-medium">{t(res)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>

            {/* Sidebar: Technical Details Data Sheet */}
            <div className="lg:col-span-4 space-y-8">
              <ScrollReveal className="space-y-8" delayMs={100}>
                <div className="bg-white border border-[#16211B]/15 p-6 lg:p-8 sticky top-28 space-y-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-[#16211B]/10 text-xs font-mono uppercase tracking-wider text-[#0E482C] font-semibold">
                    <Cpu className="w-4 h-4 text-[#BA9B60]" />
                    <span>{t("Technical Data Sheet")}</span>
                  </div>

                  <div className="divide-y divide-[#16211B]/10">
                    {project.specs.map((spec, idx) => (
                      <div key={idx} className="py-3 flex flex-col">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#334439]/70">{t(spec.label)}</span>
                        <span className="text-sm font-semibold text-[#121815] font-mono mt-0.5">{t(spec.value)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[#16211B]/10">
                    <button
                      onClick={() => onOpenProjectModal?.(t("Engineering Consultation for {title}", { title: t(project.title) }))}
                      className="w-full py-3.5 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-colors flex items-center justify-center gap-2 cursor-pointer s-btn"
                    >
                      <span>{t("Consult on Similar Plant")}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#BA9B60]" />
                    </button>

                    <Link
                      to="/projects"
                      className="w-full mt-3 py-3 border border-[#16211B]/20 text-[#334439] font-mono text-xs tracking-widest uppercase hover:bg-[#F3F3EC] transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t("All Projects Index")}</span>
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </div>
      </section>

      {/* 6. LARGE PROJECT IMAGE — Process Hall in Operation */}
      <section className="border-b border-[#16211B]/10 bg-[#07130E] overflow-hidden">
        <ScrollReveal>
          <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[380px] image-zoom-container">
            <img
              src="/images/tech_integrated_plant_1790271239031.jpg"
              alt={t("Hygienic Separation Equipment Hall")}
              className="w-full h-full object-cover opacity-90"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute bottom-6 start-6 end-6 max-w-[1400px] mx-auto text-white">
              <div className="text-[10px] font-mono text-[#BA9B60] uppercase tracking-widest">
                {t("ARCHIVAL ENGINEERING RECORD")}
              </div>
              <div className="font-serif text-xl sm:text-2xl text-[#FBFBF8] mt-1">
                {t("Precision Separation & Multi-Stage Evaporation Infrastructure")}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 7. GALLERY & ARCHIVES */}
      {project.gallery && project.gallery.length > 1 && (
        <section className="py-16 lg:py-20 border-b border-[#16211B]/10">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <ScrollReveal>
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-3 font-semibold">
                {t("05 · FACILITY ARCHIVE IMAGERY")}
              </div>
              <h3 className="font-serif text-3xl text-[#121815] mb-8">
                {t("Site Photographic Documentation")}
              </h3>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {project.gallery.map((img, idx) => (
                <ScrollReveal key={idx} delayMs={idx * 100}>
                  <div className="relative aspect-[16/10] overflow-hidden border border-[#16211B]/15 bg-[#07130E] image-zoom-container">
                    <img loading="lazy" decoding="async" src={img} alt={t("{title} archive {n}", { title: t(project.title), n: idx + 1 })} className="w-full h-full object-cover" />
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. PREVIOUS / NEXT PROJECT NAVIGATION */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 border-b border-[#16211B]/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to={`/projects/${prevProject.slug}`}
            className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center gap-4"
          >
            <ArrowLeft className="w-5 h-5 text-[#BA9B60] group-hover:-translate-x-1 transition-transform" />
            <div>
              <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t("PREVIOUS PROJECT")}</div>
              <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{t(prevProject.title)}</div>
              <div className="text-xs font-mono text-[#334439]/80">{t(prevProject.country)} · {t(prevProject.years)}</div>
            </div>
          </Link>

          <Link
            to={`/projects/${nextProject.slug}`}
            className="group p-6 bg-white border border-[#16211B]/10 hover:border-[#0E482C] transition-colors flex items-center justify-between text-end"
          >
            <div>
              <div className="text-[10px] font-mono uppercase text-[#334439]/60">{t("NEXT PROJECT")}</div>
              <div className="font-serif text-lg text-[#121815] group-hover:text-[#0E482C] font-semibold">{t(nextProject.title)}</div>
              <div className="text-xs font-mono text-[#334439]/80">{t(nextProject.country)} · {t(nextProject.years)}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-[#BA9B60] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* 9. CTA */}
      <CtaSection
        badge={t("ENGINEERING FEASIBILITY")}
        title={t("Inquire About Engineering a Plant Like {title}", { title: t(project.title) })}
        description={t("Our multi-disciplinary chemical engineering team provides full cycle basic engineering, capital expenditure budgeting, and yield performance guarantees.")}
        topic={t("Project Case Study Inquiry: {title}", { title: t(project.title) })}
      />
    </div>
  );
};
