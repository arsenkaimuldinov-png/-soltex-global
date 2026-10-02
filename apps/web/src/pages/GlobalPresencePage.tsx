import React from 'react';
import { topicCopy, topicRef, topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { MapPin, Mail, Phone, Globe, Building2, ArrowRight, ShieldCheck, Compass } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { CtaSection } from '../components/CtaSection';
import { ScrollReveal } from '../components/ScrollReveal';
import { useI18n } from '../i18n/I18nProvider';

export const GlobalPresencePage: React.FC<{ onOpenProjectModal?: (topic?: InquiryTopic) => void }> = ({ onOpenProjectModal }) => {
  const { t, tr } = useI18n();
  const { header, c } = usePage('globalPresence');
  const { settings } = useContent();
  const hq = settings.headquarters;
  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.company'), href: '/company' }, { label: t('breadcrumb.globalPresence') }]}
        primaryAction={{
          label: header?.actionLabel ?? '',
          onClick: () => onOpenProjectModal?.(topicCopy('globalPresence', 'inquiryTopic'))
        }}
      />

      {/* Main Geography Overview */}
      <section className="py-16 lg:py-24 border-b border-[#16211B]/10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
            <div className="lg:col-span-6 space-y-4">
              <ScrollReveal className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] font-semibold">
                  {c('corridorsEyebrow')}
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl text-[#121815]">
                  {c('corridorsHeading')}
                </h2>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {c('corridorsParagraph1')}
                </p>
                <p className="text-base text-[#334439] leading-relaxed font-light">
                  {c('corridorsParagraph2')}
                </p>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-6">
              <ScrollReveal delayMs={100}>
                <div className="bg-[#07130E] text-white p-8 lg:p-10 border border-[#16211B]/30 relative overflow-hidden shadow-xl">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#BA9B60] mb-3 font-semibold">
                    {c('headquartersEyebrow')}
                  </div>
                  <h3 className="font-serif text-2xl lg:text-3xl text-white mb-4">
                    {hq.shortAddress}
                  </h3>
                  <p className="text-sm text-[#FBFBF8]/80 leading-relaxed font-light mb-6">
                    {c('headquartersText')}
                  </p>
                  <div className="pt-4 border-t border-white/10 flex flex-wrap gap-6 text-xs font-mono text-white/90">
                    <div>
                      <span className="text-[#BA9B60] block font-semibold">{t('office.jurisdiction')}</span>
                      <span>{hq.jurisdiction}</span>
                    </div>
                    <div>
                      <span className="text-[#BA9B60] block font-semibold">{t('office.communications')}</span>
                      <a href={`mailto:${hq.email}`} className="hover:text-[#BA9B60] underline">
                        {hq.email}
                      </a>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Detailed Office Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {settings.offices.map((office, idx) => (
              <ScrollReveal key={idx} delayMs={idx * 80}>
                <div
                  className="bg-white border border-[#16211B]/15 p-8 flex flex-col justify-between hover:border-[#0E482C] transition-all duration-300 shadow-xs h-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-mono bg-beige-soft px-2.5 py-1 border border-taupe/50 text-[#0E482C] uppercase tracking-wider font-semibold">
                        {office.region}
                      </span>
                      <span className="text-xs font-mono text-[#334439]/60 uppercase font-semibold">
                        {tr('office.hubNumber', { n: idx + 1 })}
                      </span>
                    </div>

                    <h3 className="font-serif text-2xl text-[#121815] mb-2 font-bold">
                      {office.title}
                    </h3>

                    <div className="text-xs font-mono text-[#0E482C] uppercase tracking-wider mb-4 font-semibold">
                      {office.country}
                    </div>

                    {office.address && (
                      <div className="flex items-start gap-2.5 text-sm text-[#334439] mb-4 font-light">
                        <MapPin className="w-4 h-4 text-[#BA9B60] shrink-0 mt-0.5" />
                        <span>{office.address}</span>
                      </div>
                    )}

                    {office.representative && (
                      <div className="text-xs text-[#334439]/80 font-mono mb-2">
                        <span className="text-[#334439]/50 uppercase">{t('office.deskLead')}</span> {office.representative}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-[#16211B]/10 mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                      {office.phone && (
                        <div className="flex items-center gap-2 text-xs font-mono text-[#334439]">
                          <Phone className="w-3.5 h-3.5 text-[#0E482C]" />
                          <a href={`tel:${office.phone}`} className="hover:text-[#0E482C]">{office.phone}</a>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs font-mono text-[#0E482C]">
                        <Mail className="w-3.5 h-3.5" />
                        <a href={`mailto:${office.email}`} className="hover:underline">{office.email}</a>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenProjectModal?.(topicUi('office.inquiryTopic', { office: topicRef('office', office.id) }))}
                      className="px-4 py-2 bg-[#F3F3EC] hover:bg-[#0E482C] hover:text-white border border-[#16211B]/15 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer s-btn"
                    >
                      {t('office.directConsultation')}
                    </button>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Global Project Reference Sites */}
      <section className="py-16 lg:py-24 bg-beige-soft">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <ScrollReveal>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
              {c('sitesEyebrow')}
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#121815] mb-12">
              {c('sitesHeading')}
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScrollReveal delayMs={50}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{c('site1Region')}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{c('site1Title')}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {c('site1Text')}
                  </p>
                </div>
                <Link to="/projects/solbar-israel" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t('globalPresence.viewProject')}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={100}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{c('site2Region')}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{c('site2Title')}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {c('site2Text')}
                  </p>
                </div>
                <Link to="/projects/solbar-ningbo" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t('globalPresence.viewProject')}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={150}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{c('site3Region')}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{c('site3Title')}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {c('site3Text')}
                  </p>
                </div>
                <Link to="/projects/siberian-wellness" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t('globalPresence.viewProject')}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={200}>
              <div className="bg-white border border-[#16211B]/15 p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-[#0E482C] font-bold uppercase mb-2">{c('site4Region')}</div>
                  <h3 className="font-serif text-xl font-bold mb-2">{c('site4Title')}</h3>
                  <p className="text-xs text-[#334439] leading-relaxed mb-4 font-light">
                    {c('site4Text')}
                  </p>
                </div>
                <Link to="/projects" className="text-xs font-mono text-[#0E482C] font-semibold flex items-center gap-1 hover:underline">
                  {t('globalPresence.exploreAllSites')}{" "}<ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CtaSection
        badge={c('ctaBadge')}
        title={c('ctaTitle')}
        description={c('ctaDescription')}
      />
    </div>
  );
};
