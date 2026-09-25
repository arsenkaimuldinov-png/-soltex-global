import React, { useState } from 'react';
import { X, CheckCircle2, ArrowRight, MapPin, Mail, Phone, Clock, ShieldCheck } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProjectModal: (topic?: string) => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 450);
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setName('');
    setPhone('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#07130D]/80 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-[#FFFFFF] border border-[#16211B]/20 shadow-2xl z-10 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Bar */}
        <div className="bg-[#0E482C] px-6 py-4 flex items-center justify-between text-white border-b border-[#0A3620]">
          <div className="flex items-center gap-3">
            <span className="font-tech text-xs tracking-widest text-[#D4B982] uppercase">
              SOLTEX GLOBAL
            </span>
            <span className="text-white/40">|</span>
            <span className="text-xs text-white/80 font-medium">Direct Engineering Desk</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left Column: Office Details */}
            <div className="space-y-4">
              <span className="font-tech text-[11px] font-bold text-[#0E482C] tracking-widest uppercase block">
                HEADQUARTERS & DESKS
              </span>
              <h3 className="font-serif text-2xl font-bold text-[#121815] leading-tight">
                Global Liaison
              </h3>
              <p className="text-xs text-[#526458] leading-relaxed">
                Connect directly with our regional engineering representatives for plant feasibility, feedstock assessment, and project execution.
              </p>

              <div className="pt-2 border-t border-[#16211B]/10 space-y-2.5 text-xs text-[#334439] font-mono">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0E482C] shrink-0 mt-0.5" />
                  <span>Sharjah Media City (Shams), UAE</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-[#0E482C] shrink-0" />
                  <a href="mailto:info@soltexglobal.co" className="hover:text-[#0E482C] font-semibold">
                    info@soltexglobal.co
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#B89758] shrink-0" />
                  <span>Mon – Fri: 08:30 – 17:30 (GST)</span>
                </div>
              </div>
            </div>

            {/* Right Column: Simplified 2-Field Lead Form */}
            <div className="bg-[#FBFBF8] border border-[#16211B]/12 p-6">
              {isSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-[#0E482C] mx-auto" />
                  <h4 className="font-serif text-lg font-bold text-[#111814]">
                    Lead Received
                  </h4>
                  <p className="text-xs text-[#526458]">
                    Thank you, <strong className="text-[#121815]">{name}</strong>. An engineering director will reach you at <strong className="text-[#0E482C]">{phone}</strong> shortly.
                  </p>
                  <button
                    onClick={handleReset}
                    className="mt-3 px-5 py-2 bg-[#0E482C] text-white text-xs font-mono uppercase tracking-wider hover:bg-[#0A3620]"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block font-tech text-[11px] font-bold uppercase text-[#334439] mb-1.5">
                      YOUR NAME
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#16211B]/20 text-xs text-[#121815] focus:outline-hidden focus:border-[#0E482C]"
                    />
                  </div>

                  <div>
                    <label className="block font-tech text-[11px] font-bold uppercase text-[#334439] mb-1.5">
                      PHONE NUMBER
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 ___ ___ __ __"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#16211B]/20 text-xs text-[#121815] focus:outline-hidden focus:border-[#0E482C]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#0E482C] text-white font-tech text-xs font-bold tracking-widest uppercase hover:bg-[#0A3620] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-70"
                  >
                    <span>{isSubmitting ? 'PROCESSING...' : 'START YOUR PROJECT'}</span>
                    <ArrowRight className="w-4 h-4 text-[#BA9B60]" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
