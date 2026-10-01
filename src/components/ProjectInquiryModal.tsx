import React, { useState } from 'react';
import { X, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useDialog } from '../hooks/useDialog';
import { usePresence } from '../motion/usePresence';
import { leadService } from '../services/leads';
import { resolveInquiryTopic, type InquiryTopic } from '../services/leads/topics';

interface ProjectInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Inquiry topic descriptor; resolved in the current language on every render. */
  preselectedTopic?: InquiryTopic;
}

export const ProjectInquiryModal: React.FC<ProjectInquiryModalProps> = ({
  isOpen,
  onClose,
  preselectedTopic
}) => {
  const { t, tr, locale, path, content } = useI18n();
  const topicText = preselectedTopic ? resolveInquiryTopic(preselectedTopic, t, content) : null;
  const formId = React.useId();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reference, setReference] = useState('');
  useDialog(isOpen, onClose);
  const presence = usePresence(isOpen || null, 220);

  if (!presence.item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    void leadService
      .submitLead({
        formType: 'inquiry_modal',
        fields: { name, phone },
        topic: topicText,
        locale,
        pagePath: path,
      })
      .then((result) => {
        setIsSubmitting(false);
        if (result.ok) {
          // The reference is created when the inquiry is submitted, never during rendering.
          setReference(result.reference);
          setSubmitted(true);
        }
      });
  };

  const handleReset = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto ${presence.exiting ? 'is-exiting' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('inquiry.eyebrow')}
    >
      {/* Backdrop */}
      <div
        className="s-backdrop fixed inset-0 bg-[#07130D]/80 backdrop-blur-xs"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-[#FFFFFF] border border-[#16211B]/20 shadow-2xl z-10 overflow-hidden my-8 s-panel">
        {/* Top Header Bar */}
        <div className="bg-[#0E482C] px-6 py-4 flex items-center justify-between text-white border-b border-[#0A3620]">
          <div className="flex items-center gap-3">
            <span className="font-tech text-xs tracking-widest text-[#D4B982] uppercase">
              {t('inquiry.eyebrow')}
            </span>
            <span className="text-white/40">|</span>
            <span className="text-xs text-white/80 font-medium">{t('inquiry.desk')}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 cursor-pointer"
            aria-label={t('common.closeModal')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 sm:p-10 text-center space-y-4">
            <div className="w-14 h-14 bg-[#0E482C]/10 text-[#0E482C] mx-auto flex items-center justify-center border border-[#0E482C]/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <span className="font-tech text-xs text-[#B89758] tracking-widest uppercase block">
              {t('inquiry.successEyebrow')}
            </span>
            <h3 className="text-2xl font-bold text-[#121815]">
              {t('inquiry.successTitle')}
            </h3>
            <p className="text-[#3A4A41] text-sm leading-relaxed max-w-md mx-auto font-light">
              {tr('inquiry.successText', {
                name: <strong className="text-[#121815]">{name}</strong>,
                phone: <strong className="text-[#0E482C]">{phone}</strong>,
              })}
            </p>

            <div className="bg-[#F8F8F4] border border-[#E3E3D9] p-3 max-w-xs mx-auto text-center font-tech text-xs text-[#425248]">
              {t('inquiry.reference')} <span className="text-[#0E482C] font-semibold">{reference}</span>
              {preselectedTopic && <div className="text-[10px] text-[#334439]/70 mt-0.5">{topicText}</div>}
            </div>

            <button
              onClick={handleReset}
              className="mt-2 inline-flex items-center justify-center px-6 py-3 bg-[#0E482C] text-white text-xs font-semibold tracking-wider uppercase hover:bg-[#0A3620] transition-colors cursor-pointer s-btn"
            >
              {t('inquiry.closeWindow')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            <div>
              <h3 className="text-2xl font-bold text-[#121815] tracking-tight mb-1.5 font-serif">
                {t('inquiry.title')}
              </h3>
              <p className="text-xs text-[#4E5E55] leading-relaxed">
                {t('inquiry.intro')}
              </p>
              {preselectedTopic && (
                <div className="mt-2 text-[11px] font-mono text-[#0E482C] font-semibold bg-beige-soft px-2.5 py-1 inline-block border border-taupe/50">
                  {tr('inquiry.focus', { topic: topicText })}
                </div>
              )}
            </div>

            {/* Field 1: YOUR NAME */}
            <div>
              <label htmlFor={`${formId}-0`} className="block font-tech text-[11px] uppercase tracking-wider text-[#334439] font-bold mb-1.5">
                {t('leadForm.yourName')}
              </label>
              <input id={`${formId}-0`}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('leadForm.enterName')}
                className="w-full px-3.5 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm text-[#121815] focus:outline-hidden focus:border-[#0E482C] transition-colors"
              />
            </div>

            {/* Field 2: PHONE NUMBER */}
            <div>
              <label htmlFor={`${formId}-1`} className="block font-tech text-[11px] uppercase tracking-wider text-[#334439] font-bold mb-1.5">
                {t('leadForm.phoneNumber')}
              </label>
              <input id={`${formId}-1`}
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 ___ ___ __ __"
                className="w-full px-3.5 py-3 bg-[#FBFBF8] border border-[#16211B]/20 text-sm text-[#121815] focus:outline-hidden focus:border-[#0E482C] transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#334439]/70 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0E482C] shrink-0" />
              <span>{t('inquiry.privacyNote')}</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#0E482C] text-white font-tech text-xs font-bold tracking-widest uppercase hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-70 s-btn"
            >
              <span>{isSubmitting ? t('leadForm.processing') : t('common.startYourProject')}</span>
              <ArrowRight className="w-4 h-4 text-[#BA9B60]" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
