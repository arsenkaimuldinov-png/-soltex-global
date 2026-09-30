import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ScrollReveal } from '../components/ScrollReveal';
import { GLOBAL_OFFICES } from '../data/pagesData';
import { useI18n } from '../i18n/I18nProvider';

export const ContactPage: React.FC = () => {
  const { t, tr } = useI18n();
  const formId = React.useId();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.email) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 450);
  };

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        badgeNumber="06"
        badgeLabel={t("COMMUNICATIONS DESK")}
        title={t("Engineering Inquiries & Global Representation")}
        subtitle={t("Direct Collaboration with Soltex Global Project Directors")}
        description={t("Connect with our central engineering bureau in the UAE or our regional project offices in Israel, China, Bulgaria, and Eurasia. All technical consultations are conducted under mutual non-disclosure protocols.")}
        breadcrumbs={[
          { label: 'Contact' }
        ]}
        metaTags={[
          { label: 'Central Registry', value: 'Sharjah Media City, UAE' },
          { label: 'Response Protocol', value: 'Within 24 Working Hours' },
          { label: 'Direct Desk', value: 'info@soltexglobal.co' },
          { label: 'Technical NDA', value: 'Standard Industrial Terms' }
        ]}
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* Left Column: Simplified Expanded Inquiry Form */}
            <div className="lg:col-span-7 bg-white border border-[#16211B]/15 p-8 lg:p-12 shadow-xs">
              <ScrollReveal>
                <div className="border-b border-[#16211B]/10 pb-6 mb-8">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {t("PROJECT INTAKE DOSSIER")}
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl text-[#121815]">
                    {t("Initiate Technical Dialogue")}
                  </h2>
                  <p className="text-sm text-[#334439] mt-2 font-light">
                    {t("Provide your key project coordinates to receive a direct preliminary technology review from our lead engineers.")}
                  </p>
                </div>
              </ScrollReveal>

              {submitted ? (
                <div className="bg-[#F3F3EC] border border-[#0E482C]/30 p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-[#0E482C] text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-serif text-2xl text-[#121815]">{t("Inquiry Successfully Dispatched")}</h3>
                  <p className="text-sm text-[#334439] max-w-md mx-auto leading-relaxed font-light">
                    {tr("Thank you, {name}. Your project dossier has been routed to our senior chemical engineering team.", {
                      name: <strong className="text-[#121815]">{formData.name}</strong>,
                    })}
                  </p>
                  <div className="text-xs font-mono text-[#334439]/70 pt-2">
                    {tr("A confirmation record has been registered for {email}.", {
                      email: <span className="font-semibold text-[#0E482C]">{formData.email}</span>,
                    })}
                  </div>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: '',
                        phone: '',
                        email: '',
                        company: '',
                        description: ''
                      });
                    }}
                    className="mt-4 px-6 py-2.5 bg-[#0E482C] text-white font-mono text-xs tracking-wider uppercase hover:bg-[#07130E] transition-colors cursor-pointer s-btn"
                  >
                    {t("Send Another Inquiry")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`${formId}-0`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t("NAME")} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-0`}
                        type="text"
                        required
                        placeholder={t("Dr. Alexander Vance")}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>

                    <div>
                      <label htmlFor={`${formId}-1`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t("PHONE")} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-1`}
                        type="tel"
                        required
                        placeholder="+971 50 000 0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>
                  </div>

                  {/* Email + Company */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`${formId}-2`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t("EMAIL")} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-2`}
                        type="email"
                        required
                        placeholder={t("project.desk@company.com")}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>

                    <div>
                      <label htmlFor={`${formId}-3`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t("COMPANY")} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-3`}
                        type="text"
                        required
                        placeholder={t("AgriTech Agro Holding")}
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>
                  </div>

                  {/* Short Project Description */}
                  <div>
                    <label htmlFor={`${formId}-4`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                      {t("SHORT PROJECT DESCRIPTION")}
                    </label>
                    <textarea id={`${formId}-4`}
                      rows={4}
                      placeholder={t("Outline target raw material (e.g. apple pomace, soy, inulin), planned scale, or modernization goals...")}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#334439]/70">
                      <ShieldCheck className="w-4 h-4 text-[#0E482C]" />
                      <span>{t("Protected under mutual industrial non-disclosure terms.")}</span>
                    </div>

                    {/* Submit button: SEND INQUIRY */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-4 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-70 s-btn"
                    >
                      <Send className="w-4 h-4 text-[#BA9B60]" />
                      <span>{isSubmitting ? t('SENDING...') : t('SEND INQUIRY')}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Column: Global Office Directory & Direct Channels */}
            <div className="lg:col-span-5 space-y-8">
              <ScrollReveal className="space-y-8" delayMs={100}>
                {/* Central Engineering Bureau Card */}
                <div className="bg-[#07130E] text-white p-8 border border-[#16211B]/40 relative overflow-hidden">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#BA9B60] mb-3 font-semibold">
                    {t("PRIMARY HEADQUARTERS & EPC REGISTRY")}
                  </div>
                  <h3 className="font-serif text-2xl text-white mb-4">
                    {t("Soltex Global FZC")}
                  </h3>
                  <div className="space-y-4 text-sm font-mono text-[#FBFBF8]/80">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#BA9B60] shrink-0 mt-1" />
                      <div>
                        <div>{t("Sharjah Media City (Shams)")}</div>
                        <div className="text-white/60">{t("Al Messaned, Sharjah, United Arab Emirates")}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                      <Mail className="w-4 h-4 text-[#BA9B60] shrink-0" />
                      <a href="mailto:info@soltexglobal.co" className="text-white hover:text-[#BA9B60] transition-colors">
                        {t("info@soltexglobal.co")}
                      </a>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                      <Clock className="w-4 h-4 text-[#BA9B60] shrink-0" />
                      <span className="text-xs text-white/70">
                        {t("Sunday — Thursday: 08:30 — 17:30 GST (UTC+4)")}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={150}>
                {/* Regional Representations */}
                <div className="bg-white border border-[#16211B]/15 p-8">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-4 font-semibold">
                    {t("REGIONAL LIAISON OFFICES & REPRESENTATIVES")}
                  </div>

                  <div className="divide-y divide-[#16211B]/10">
                    {GLOBAL_OFFICES.map((office, idx) => (
                      <div key={idx} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-base font-bold text-[#121815]">{t(office.title)}</span>
                          <span className="text-[10px] font-mono bg-beige-soft px-2 py-0.5 border border-taupe/50 text-[#0E482C]">
                            {t(office.region)}
                          </span>
                        </div>
                        {office.address && (
                          <p className="text-xs text-[#334439] mt-1 font-light">{t(office.address)}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
                          {office.phone && (
                            <a href={`tel:${office.phone}`} className="text-[#334439] hover:text-[#0E482C]">
                              {t(office.phone)}
                            </a>
                          )}
                          <a href={`mailto:${office.email}`} className="text-[#0E482C] hover:underline">
                            {t(office.email)}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={200}>
                {/* Security & Confidentiality Badge */}
                <div className="bg-beige-soft border border-taupe/50 p-6 flex items-start gap-4">
                  <ShieldCheck className="w-6 h-6 text-[#0E482C] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#334439] leading-relaxed">
                    <strong className="text-[#121815] block font-mono uppercase tracking-wider mb-1">
                      {t("Industrial Intellectual Property Protection")}
                    </strong>
                    {t("Soltex Global operates strictly under signed two-way NDAs prior to disclosing mass balance calculations or custom P&ID drawings.")}
                  </div>
                </div>
              </ScrollReveal>

            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
