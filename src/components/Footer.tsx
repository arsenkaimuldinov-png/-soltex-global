import React from 'react';
import { Link } from '../i18n/Link';
import { useI18n } from '../i18n/I18nProvider';

interface FooterProps {
  onOpenProjectModal: (preselectedTopic?: string) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenProjectModal,
}) => {
  const { t } = useI18n();
  return (
    <footer className="relative bg-[#05180D] text-white overflow-hidden border-t border-[#133A20]">
      {/* High-Visibility Lush Botanical Green Leaves Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <img loading="lazy" decoding="async"
          src="/images/footer_lush_botanical_1790272735218.jpg"
          alt={t("Lush green botanical leaves texture")}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-75 scale-102"
        />
        {/* Soft, rich emerald vignette overlay that preserves the vibrant leaf texture while ensuring sharp text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#061C10]/70 via-[#05190E]/60 to-[#04140B]/80" />
      </div>

      {/* Main Footer Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12 border-b border-white/20">
          
          {/* Brand Info Column (3 cols) */}
          <div className="lg:col-span-3 pe-4">
            <Link
              to="/"
              className="inline-block mb-5 focus-visible:outline-none"
              style={{ overflow: 'visible', flexShrink: 0, whiteSpace: 'nowrap' }}
              aria-label={t("Soltex Global Home")}
            >
              <img
                src="/images/soltex-global-logo-reversed.png"
                alt={t("Soltex Global")}
                style={{
                  height: '46px',
                  width: 'auto',
                  maxWidth: 'none',
                  objectFit: 'contain',
                  display: 'block',
                }}
                loading="lazy"
              />
            </Link>
            <p className="text-xs sm:text-[12.5px] text-white/85 leading-relaxed font-normal max-w-[250px]">
              {t("Engineering & technology partner for advanced plant processing facilities worldwide.")}
            </p>
          </div>

          {/* Nav Columns: 5 Clean Groups matching Final Architecture (9 cols) */}
          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-6">
            
            {/* 01. TECHNOLOGIES */}
            <div>
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t("TECHNOLOGIES")}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/technologies/pectin" className="hover:text-white hover:underline transition-colors">{t("Pectin")}</Link></li>
                <li><Link to="/technologies/soy-protein" className="hover:text-white hover:underline transition-colors">{t("Soy Protein")}</Link></li>
                <li><Link to="/technologies/inulin" className="hover:text-white hover:underline transition-colors">{t("Inulin")}</Link></li>
                <li><Link to="/technologies/dietary-fibers" className="hover:text-white hover:underline transition-colors">{t("Dietary Fibers")}</Link></li>
                <li><Link to="/technologies" className="hover:text-[#D4B982] hover:underline transition-colors">{t("All Technologies →")}</Link></li>
              </ul>
            </div>

            {/* 02. EPCM */}
            <div>
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t("EPCM")}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/epcm" className="hover:text-white hover:underline transition-colors">{t("Feasibility Study")}</Link></li>
                <li><Link to="/epcm" className="hover:text-white hover:underline transition-colors">{t("Engineering")}</Link></li>
                <li><Link to="/epcm" className="hover:text-white hover:underline transition-colors">{t("Procurement")}</Link></li>
                <li><Link to="/epcm" className="hover:text-white hover:underline transition-colors">{t("Construction Management")}</Link></li>
                <li><Link to="/epcm" className="hover:text-white hover:underline transition-colors">{t("Turnkey Process")}</Link></li>
                <li><Link to="/epcm" className="hover:text-[#D4B982] hover:underline transition-colors">{t("All EPCM Services →")}</Link></li>
              </ul>
            </div>

            {/* 03. PRODUCTS */}
            <div>
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t("PRODUCTS")}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/products/pectin" className="hover:text-white hover:underline transition-colors">{t("Food & Pharma Pectin")}</Link></li>
                <li><Link to="/products/soy-protein-isolate" className="hover:text-white hover:underline transition-colors">{t("Soy Protein Isolate")}</Link></li>
                <li><Link to="/products/inulin-fos" className="hover:text-white hover:underline transition-colors">{t("Inulin & FOS")}</Link></li>
                <li><Link to="/products/dietary-fibers" className="hover:text-white hover:underline transition-colors">{t("Dietary Fibers")}</Link></li>
                <li><Link to="/products" className="hover:text-[#D4B982] hover:underline transition-colors">{t("All Products →")}</Link></li>
              </ul>
            </div>

            {/* 04. COMPANY */}
            <div>
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t("COMPANY")}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/company" className="hover:text-white hover:underline transition-colors">{t("About Soltex")}</Link></li>
                <li><Link to="/company/global-presence" className="hover:text-white hover:underline transition-colors">{t("Global Presence")}</Link></li>
                <li><Link to="/projects" className="hover:text-white hover:underline transition-colors">{t("Project Portfolio")}</Link></li>
                <li><Link to="/contact" className="hover:text-[#D4B982] hover:underline transition-colors">{t("Offices & Desks →")}</Link></li>
              </ul>
            </div>

            {/* 05. CONTACT */}
            <div>
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t("CONTACT")}
              </span>
              <div className="space-y-1.5 text-xs text-white/80 leading-relaxed font-medium">
                <a href="mailto:info@soltexglobal.co" className="block break-words hover:text-white transition-colors">
                  info@<wbr />soltexglobal.co
                </a>
                <span className="block text-white/70">
                  {t("Sharjah Media City (Shams), UAE")}
                </span>
                <Link
                  to="/contact"
                  className="mt-3 text-[11px] font-tech text-[#D4B982] hover:text-white underline underline-offset-2 block"
                >
                  {t("Direct Inquiry Desk →")}
                </Link>
              </div>
            </div>

          </div>

        </div>

        {/* Bottom Sub-bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/70 font-tech">
          <span>
            {t("© 2024 Soltex Global. All rights reserved.")}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenProjectModal('Privacy Policy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {t("Privacy Policy")}
            </button>
            <span className="text-white/40">|</span>
            <button
              onClick={() => onOpenProjectModal('Terms of Use')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              {t("Terms of Use")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
