import React, { useState } from 'react';
import { ArrowRight, Phone, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Link } from '../i18n/Link';
import { useI18n } from '../i18n/I18nProvider';

interface CtaSectionProps {
  badge?: string;
  title?: string;
  description?: string;
  onOpenProjectModal?: (topic?: string) => void;
  topic?: string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({
  badge = 'INITIATE INDUSTRIAL DIALOGUE',
  title = 'Ready to Engineer Your Next Processing Facility?',
  description = 'Connect directly with Soltex Global senior project directors to review plant feasibility, technology licensing, feedstock assays, and full turnkey EPC delivery timelines.',
  topic = 'Turnkey EPC Plant Inquiry'
}) => {
  const { t, tr } = useI18n();
  const formId = React.useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 450);
  };

  return (
    <section className="relative bg-[#07130E] text-white py-20 lg:py-24 border-t border-[#16211B]/30 overflow-hidden">
      {/* Background Architectural Grid & Subtle Radial Glow */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px'
        }}
      />
      <div className="absolute top-0 end-0 w-[500px] h-[500px] bg-[#0E482C]/20 rounded-full blur-3xl pointer-events-none -me-40 -mt-40" />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
        <div data-reveal-group className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Heading & Description */}
          <div className="lg:col-span-7">
            <div data-reveal="up" className="inline-flex items-center gap-2 border border-[#BA9B60]/30 bg-[#BA9B60]/10 px-3.5 py-1 text-[11px] font-mono tracking-widest text-[#BA9B60] mb-6">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="uppercase">{t(badge)}</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6 text-[#FBFBF8]">
              {t(title)}
            </h2>

            <p data-reveal="up" className="text-base sm:text-lg text-[#FBFBF8]/80 leading-relaxed max-w-xl font-light mb-8">
              {t(description)}
            </p>

            <div data-reveal="up" className="flex flex-wrap items-center gap-6 pt-2 border-t border-white/10 text-xs font-mono text-[#FBFBF8]/70">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#BA9B60]" />
                <span>{t("Confidential Engineering Non-Disclosure")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0E482C]" />
                <span>{t("Response SLA: < 24h")}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Simplified Quick Lead Form (Name + Phone Only) */}
          <div data-reveal="up" style={{ '--rv-i': 3 } as React.CSSProperties} className="lg:col-span-5 bg-[#0A1A14] border border-[#16211B]/50 p-7 lg:p-8 relative shadow-xl">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#BA9B60] mb-2 font-semibold">
              {t("QUICK PROJECT INQUIRY")}
            </div>
            <h3 className="font-serif text-xl font-bold text-white mb-5">
              {t("Start Your Project Dialogue")}
            </h3>

            {submitted ? (
              <div className="py-8 text-center space-y-3 bg-[#07130E]/60 border border-[#0E482C]/40 p-6">
                <CheckCircle2 className="w-10 h-10 text-[#BA9B60] mx-auto" />
                <h4 className="font-serif text-lg text-white">{t("Lead Successfully Dispatched")}</h4>
                <p className="text-xs text-[#FBFBF8]/80 font-light leading-relaxed">
                  {tr("Thank you, {name}. A Soltex Global senior project lead will contact you at {phone}.", {
                    name: <strong className="text-white">{name}</strong>,
                    phone: <strong className="text-[#BA9B60]">{phone}</strong>,
                  })}
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setName('');
                    setPhone('');
                  }}
                  className="mt-3 px-4 py-2 bg-[#0E482C] text-white text-[11px] font-mono uppercase tracking-wider hover:bg-[#07130E] transition-colors cursor-pointer s-btn"
                >
                  {t("Send Another Inquiry")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor={`${formId}-0`} className="block font-tech text-[10.5px] uppercase tracking-wider text-[#FBFBF8]/80 font-bold mb-1.5">
                    {t("YOUR NAME")}
                  </label>
                  <input id={`${formId}-0`}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("Enter your name")}
                    className="w-full px-4 py-3 bg-[#07130E] border border-white/15 text-sm text-white focus:outline-hidden focus:border-[#BA9B60] transition-colors placeholder:text-white/30"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-1`} className="block font-tech text-[10.5px] uppercase tracking-wider text-[#FBFBF8]/80 font-bold mb-1.5">
                    {t("PHONE NUMBER")}
                  </label>
                  <input id={`${formId}-1`}
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 ___ ___ __ __"
                    className="w-full px-4 py-3 bg-[#07130E] border border-white/15 text-sm text-white focus:outline-hidden focus:border-[#BA9B60] transition-colors placeholder:text-white/30"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-[#BA9B60] text-[#07130E] font-tech text-xs font-bold tracking-widest uppercase hover:bg-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-75 s-btn"
                >
                  <span>{submitting ? t('PROCESSING...') : t('START YOUR PROJECT')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#FBFBF8]/60">
              <span>{t("Direct Desk:")}</span>
              <a href="mailto:info@soltexglobal.co" className="text-[#BA9B60] hover:underline">
                {t("info@soltexglobal.co")}
              </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
