import React from 'react';
import { Link } from '../i18n/Link';
import { MapPin, Mail, Phone, Globe, Building2, ArrowRight, ShieldCheck, Compass } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { GLOBAL_OFFICES } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

export const GlobalPresencePage: React.FC<{ onOpenProjectModal?: (topic?: string) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        badgeNumber="02"
        badgeLabel={t("GEOGRAPHIC NETWORK")}
        title={t("Global Industrial Presence & Regional Hubs")}
        subtitle={t("Bridging International Engineering Precision with Local Agro-Industrial Hubs")}
        description={t("Soltex Global coordinates multi-national turnkey projects from our corporate engineering headquarters in the United Arab Emirates, backed by regional offices, certified fabrication partners, and operational facilities across Israel, China, Uzbekistan, and Eurasia.")}
        breadcrumbs={[
          { label: 'Company', href: '/company' },
          { label: 'Global Presence' }
        ]}
        metaTags={[
          { label: 'HQ Registry', value: 'Sharjah, UAE' },
          { label: 'Primary Regions', value: 'Middle East, Asia, CIS' },
          { label: 'Project Delivery', value: 'Multi-jurisdictional' },
          { label: 'Language Coverage', value: 'English, Russian, Chinese, Hebrew' }
        ]}
        primaryAction={{
          label: 'Contact Regional Director',
          onClick: () => onOpenProjectModal?.('Regional Office Inquiry')
        }}
      />

      {/* Main Geography Overview */}
      <section className="py-16 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
            <div className="lg:col-span-6 space-y-4">
              <ScrollReveal className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {t("01 · STRATEGIC GEOGRAPHIC CORRIDORS")}
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {t("Seamless Cross-Border Project Execution")}
                </h2>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {t("Large-scale industrial plants require rigorous international coordination: high-precision titanium and stainless reactor manufacturing in specialized hubs, global logistics, on-site civil management, and local regulatory adherence.")}
                </p>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {t("Our distributed office network ensures that Soltex Global clients receive direct face-to-face engineering guidance and around-the-clock site oversight throughout all construction and commissioning phases.")}
                </p>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-6">
              <ScrollReveal delayMs={100}>
                <div className="bg-[#07130E] text-white p-8 lg:p-10 border border-[#16211B]/30 relative overflow-hidden shadow-xl">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#BA9B60] mb-3 font-semibold">
                    {t("HEADQUARTERS & EPC COORDINATION")}
                  </div>
                  <h3 className="font-serif text-2xl lg:text-3xl text-white mb-4">
                    {t("Sharjah Media City (Shams), UAE")}
                  </h3>
                  <p className="text-sm text-[#FBFBF8]/80 leading-relaxed font-light mb-6">
                    {t("Our central corporate base governs overall contract administration, international patent management, and strategic procurement for mega-projects.")}
                  </p>
                  <div className="pt-4 border-t border-white/10 flex flex-wrap gap-6 text-xs font-mono text-white/90">
                    <div>
                      <span className="text-[#BA9B60] block font-semibold">{t("JURISDICTION:")}</span>
                      <span>{t("United Arab Emirates")}</span>
                    </div>
                    <div>
                      <span className="text-[#BA9B60] block font-semibold">{t("COMMUNICATIONS:")}</span>
                      <a href="mailto:info@soltexglobal.co" className="hover:text-[#BA9B60] underline">
                        {t("info@soltexglobal.co")}
                      </a>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Detailed Office Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {GLOBAL_OFFICES.map((office, idx) => (
              <ScrollReveal key={idx} delayMs={idx * 80}>
                <div
                  className="bg-white border border-[#16211B]/15 p-8 flex flex-col justify-between hover:border-[#0E482C] transition-all duration-300 shadow-xs h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-mono bg-[#F3F3EC] px-2.5 py-1 border border-[#16211B]/10 text-[#0E482C] uppercase tracking-wider font-semibold">
                        {t(office.region)}
                      </span>
                      <span className="text-xs font-mono text-[#334439]/60 uppercase font-semibold">
                        {tr("HUB 0{n}", { n: idx + 1 })}
                      </span>
                    </div>

                    <h3 className="font-serif text-2xl text-[#121815] mb-2 font-bold">
                      {t(office.title)}
                    </h3>

                    <div className="text-xs font-mono text-[#0E482C] uppercase tracking-wider mb-4 font-semibold">
                      {t(office.country)}
                    </div>

                    {office.address && (
                      <div className="flex items-start gap-2.5 text-sm text-[#334439] mb-4 font-light">
                        <MapPin className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                        <span>{t(office.address)}</span>
                      </div>
                    )}

                    {office.representative && (
                      <div className="text-xs text-[#334439]/80 font-mono mb-2">
                        <span className="text-[#334439]/50 uppercase">{t("Desk Lead:")}</span> {t(office.representative)}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-[#16211B]/10 mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      {office.phone && (
                        <div className="flex items-center gap-2 text-xs font-mono text-[#334439]">
                          <Phone className="w-3.5 h-3.5 text-[#0E482C]" />
                          <a href={`tel:${office.phone}`} className="hover:text-[#0E482C]">{t(office.phone)}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs font-mono text-[#0E482C]">
                        <Mail className="w-3.5 h-3.5" />
                        <a href={`mailto:${office.email}`} className="hover:underline">{t(office.email)}</a>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenProjectModal?.(t("Regional Inquiry: {office}", { office: t(office.title) }))}
                      className="px-4 py-2 bg-[#F3F3EC] hover:bg-[#0E482C] hover:text-white border border-[#16211B]/15 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {t("Direct Consultation")}
                    </button>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Global Project Reference Sites */}
      <section className="py-16 lg:py-24 bg-[#F3F3EC]/50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
              {t("02 · INTERNATIONAL REFERENCE SITES")}
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#121815] mb-12">
              {t("Operational Facilities by Region")}
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScrollReveal delayMs={50}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{t("MIDDLE EAST")}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{t("Ashdod, Israel")}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {t("17,000 t/year soy protein isolate manufacturing facility. Continuously operating for 18+ years.")}
                  </p>
                </div>
                <Link to="/projects/solbar-israel" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t("View Project")}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{t("EAST ASIA")}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{t("Ningbo, China")}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {t("10,000 t/year turnkey deep soy processing complex. High-purity isolate from defatted white flake.")}
                  </p>
                </div>
                <Link to="/projects/solbar-ningbo" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t("View Project")}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={150}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{t("CENTRAL ASIA")}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{t("Namangan, Uzbekistan")}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {t("1,000 t/year apple pectin industrial manufacturing plant. Turnkey EPC execution from raw pomace intake.")}
                  </p>
                </div>
                <Link to="/projects/siberian-wellness" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t("View Project")}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={200}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{t("EURASIA & CIS")}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{t("Multiple Industrial Sites")}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {t("Biostim, S-Protein, and Jerusalem artichoke inulin fractionation lines across key agricultural regions.")}
                  </p>
                </div>
                <Link to="/projects" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t("Explore All Sites")}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={t("GLOBAL PROJECT DISCUSSIONS")}
        title={t("Schedule an On-Site or Direct Video Conference")}
        description={t("Our global engineering directors travel regularly to review client site topography, utility tie-ins, and feedstock logistics across the Middle East, Central Asia, and Europe.")}
        topic="Global Presence Contact Request"
      />
    </div>
  );
};
