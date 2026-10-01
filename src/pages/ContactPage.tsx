import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { PageHeader, pageHeaderProps } from '../components/PageHeader';
import { useContent, usePage } from '../content/useContent';
import { leadService } from '../services/leads';
import { ScrollReveal } from '../components/ScrollReveal';
import { useI18n } from '../i18n/I18nProvider';

export const ContactPage: React.FC = () => {
  const { t, tr, locale, path } = useI18n();
  const { header, c } = usePage('contact');
  const { settings } = useContent();
  const hq = settings.headquarters;
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
    void leadService
      .submitLead({
        formType: 'contact_page',
        fields: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          company: formData.company,
          message: formData.description,
        },
        topic: null,
        locale,
        pagePath: path,
      })
      .then((result) => {
        setIsSubmitting(false);
        if (result.ok) setSubmitted(true);
      });
  };

  return (
    <div className="bg-[#FBFBF8] text-[#121815] min-h-screen">
      {/* Editorial Header */}
      <PageHeader
        {...pageHeaderProps(header)}
        breadcrumbs={[{ label: t('breadcrumb.contact') }]}
      />

      <section className="py-16 lg:py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
            
            {/* Left Column: Simplified Expanded Inquiry Form */}
            <div className="lg:col-span-7 bg-white border border-[#16211B]/15 p-8 lg:p-12 shadow-xs">
              <ScrollReveal>
                <div className="border-b border-[#16211B]/10 pb-6 mb-8">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-2 font-semibold">
                    {t('contactForm.eyebrow')}
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl text-[#121815]">
                    {t('contactForm.title')}
                  </h2>
                  <p className="text-sm text-[#334439] mt-2 font-light">
                    {t('contactForm.intro')}
                  </p>
                </div>
              </ScrollReveal>

              {submitted ? (
                <div className="bg-[#F3F3EC] border border-[#0E482C]/30 p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-[#0E482C] text-white flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="font-serif text-2xl text-[#121815]">{t('contactForm.successTitle')}</h3>
                  <p className="text-sm text-[#334439] max-w-md mx-auto leading-relaxed font-light">
                    {tr('contactForm.successText', {
                      name: <strong className="text-[#121815]">{formData.name}</strong>,
                    })}
                  </p>
                  <div className="text-xs font-mono text-[#334439]/70 pt-2">
                    {tr('contactForm.confirmation', {
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
                    {t('leadForm.sendAnother')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name + Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor={`${formId}-0`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t('contactForm.name')} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-0`}
                        type="text"
                        required
                        placeholder={t('contactForm.namePlaceholder')}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>

                    <div>
                      <label htmlFor={`${formId}-1`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t('contactForm.phone')} <span className="text-[#BA9B60]">*</span>
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
                        {t('contactForm.email')} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-2`}
                        type="email"
                        required
                        placeholder={t('contactForm.emailPlaceholder')}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>

                    <div>
                      <label htmlFor={`${formId}-3`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                        {t('contactForm.company')} <span className="text-[#BA9B60]">*</span>
                      </label>
                      <input id={`${formId}-3`}
                        type="text"
                        required
                        placeholder={t('contactForm.companyPlaceholder')}
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                      />
                    </div>
                  </div>

                  {/* Short Project Description */}
                  <div>
                    <label htmlFor={`${formId}-4`} className="block text-xs font-mono uppercase tracking-wider text-[#334439] font-bold mb-2">
                      {t('contactForm.description')}
                    </label>
                    <textarea id={`${formId}-4`}
                      rows={4}
                      placeholder={t('contactForm.descriptionPlaceholder')}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm focus:outline-hidden focus:border-[#0E482C] text-[#121815]"
                    />
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#334439]/70">
                      <ShieldCheck className="w-4 h-4 text-[#0E482C]" />
                      <span>{t('contactForm.privacyNote')}</span>
                    </div>

                    {/* Submit button: SEND INQUIRY */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-4 bg-[#0E482C] text-white font-mono text-xs tracking-widest uppercase hover:bg-[#07130E] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-70 s-btn"
                    >
                      <Send className="w-4 h-4 text-[#BA9B60]" />
                      <span>{isSubmitting ? t('contactForm.sending') : t('contactForm.send')}</span>
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
                    {c('headquartersEyebrow')}
                  </div>
                  <h3 className="font-serif text-2xl text-white mb-4">
                    {hq.name}
                  </h3>
                  <div className="space-y-4 text-sm font-mono text-[#FBFBF8]/80">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#BA9B60] shrink-0 mt-1" />
                      <div>
                        <div>{hq.addressLine1}</div>
                        <div className="text-white/60">{hq.addressLine2}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                      <Mail className="w-4 h-4 text-[#BA9B60] shrink-0" />
                      <a href={`mailto:${hq.email}`} className="text-white hover:text-[#BA9B60] transition-colors">
                        {hq.email}
                      </a>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                      <Clock className="w-4 h-4 text-[#BA9B60] shrink-0" />
                      <span className="text-xs text-white/70">
                        {hq.hours}
                      </span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={150}>
                {/* Regional Representations */}
                <div className="bg-white border border-[#16211B]/15 p-8">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E482C] mb-4 font-semibold">
                    {c('officesEyebrow')}
                  </div>

                  <div className="divide-y divide-[#16211B]/10">
                    {settings.offices.map((office, idx) => (
                      <div key={idx} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-base font-bold text-[#121815]">{office.title}</span>
                          <span className="text-[10px] font-mono bg-beige-soft px-2 py-0.5 border border-taupe/50 text-[#0E482C]">
                            {office.region}
                          </span>
                        </div>
                        {office.address && (
                          <p className="text-xs text-[#334439] mt-1 font-light">{office.address}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
                          {office.phone && (
                            <a href={`tel:${office.phone}`} className="text-[#334439] hover:text-[#0E482C]">
                              {office.phone}
                            </a>
                          )}
                          <a href={`mailto:${office.email}`} className="text-[#0E482C] hover:underline">
                            {office.email}
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
                      {c('ipTitle')}
                    </strong>
                    {c('ipText')}
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
