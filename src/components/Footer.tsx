import React from 'react';
import { topicUi, type InquiryTopic } from '../services/leads/topics';
import { Link } from '../i18n/Link';
import { useI18n } from '../i18n/I18nProvider';
import { useContent } from '../content/useContent';

interface FooterProps {
  onOpenProjectModal: (preselectedTopic?: InquiryTopic) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenProjectModal,
}) => {
  const { t } = useI18n();
  const { settings, hasPage } = useContent();
  const [emailLocal, emailDomain] = settings.primaryEmail.split('@');
  return (
    <footer className="relative bg-[#05180D] text-white overflow-hidden border-t border-[#133A20]">
      {/* High-Visibility Lush Botanical Green Leaves Background */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <img loading="lazy" decoding="async"
          src={settings.footerBackground.src}
          alt={settings.footerBackgroundAlt}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-75 scale-102"
        />
        {/* Soft, rich emerald vignette overlay that preserves the vibrant leaf texture while ensuring sharp text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#061C10]/70 via-[#05190E]/60 to-[#04140B]/80" />
      </div>

      {/* Main Footer Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div data-reveal-group className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-12">
          
          {/* Brand Info Column (3 cols) */}
          <div data-reveal="up" className="lg:col-span-3 pe-4">
            <Link
              to="/"
              className="inline-block mb-5 focus-visible:outline-none"
              style={{ overflow: 'visible', flexShrink: 0, whiteSpace: 'nowrap' }}
              aria-label={t('common.homeLinkLabel')}
            >
              <img
                src={settings.logoReversed.src}
                alt={t('common.logoAlt')}
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
              {settings.footerTagline}
            </p>
          </div>

          {/* Nav Columns: 5 Clean Groups matching Final Architecture (9 cols) */}
          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-6">
            
            {/* 01. TECHNOLOGIES */}
            <div data-reveal="up">
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t('footer.technologies')}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/technologies/pectin" className="hover:text-white transition-colors s-link">{t('footer.pectin')}</Link></li>
                <li><Link to="/technologies/soy-protein" className="hover:text-white transition-colors s-link">{t('footer.soyProtein')}</Link></li>
                <li><Link to="/technologies/inulin" className="hover:text-white transition-colors s-link">{t('footer.inulin')}</Link></li>
                <li><Link to="/technologies/dietary-fibers" className="hover:text-white transition-colors s-link">{t('footer.dietaryFibers')}</Link></li>
                <li><Link to="/technologies" className="hover:text-[#D4B982] transition-colors s-link">{t('footer.allTechnologies')}</Link></li>
              </ul>
            </div>

            {/* 02. EPCM */}
            <div data-reveal="up">
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t('footer.epcm')}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/epcm" className="hover:text-white transition-colors s-link">{t('footer.feasibilityStudy')}</Link></li>
                <li><Link to="/epcm" className="hover:text-white transition-colors s-link">{t('footer.engineering')}</Link></li>
                <li><Link to="/epcm" className="hover:text-white transition-colors s-link">{t('footer.procurement')}</Link></li>
                <li><Link to="/epcm" className="hover:text-white transition-colors s-link">{t('footer.constructionManagement')}</Link></li>
                <li><Link to="/epcm" className="hover:text-white transition-colors s-link">{t('footer.turnkeyProcess')}</Link></li>
                <li><Link to="/epcm" className="hover:text-[#D4B982] transition-colors s-link">{t('footer.allEpcmServices')}</Link></li>
              </ul>
            </div>

            {/* 03. PRODUCTS */}
            <div data-reveal="up">
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t('footer.products')}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/products/pectin" className="hover:text-white transition-colors s-link">{t('footer.foodPharmaPectin')}</Link></li>
                <li><Link to="/products/soy-protein-isolate" className="hover:text-white transition-colors s-link">{t('footer.soyProteinIsolate')}</Link></li>
                <li><Link to="/products/inulin-fos" className="hover:text-white transition-colors s-link">{t('footer.inulinFos')}</Link></li>
                <li><Link to="/products/dietary-fibers" className="hover:text-white transition-colors s-link">{t('footer.dietaryFibers')}</Link></li>
                <li><Link to="/products" className="hover:text-[#D4B982] transition-colors s-link">{t('footer.allProducts')}</Link></li>
              </ul>
            </div>

            {/* 04. COMPANY */}
            <div data-reveal="up">
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t('footer.company')}
              </span>
              <ul className="space-y-2 text-xs text-white/80 font-medium">
                <li><Link to="/company" className="hover:text-white transition-colors s-link">{t('footer.aboutSoltex')}</Link></li>
                <li><Link to="/company/global-presence" className="hover:text-white transition-colors s-link">{t('footer.globalPresence')}</Link></li>
                <li><Link to="/projects" className="hover:text-white transition-colors s-link">{t('footer.projectPortfolio')}</Link></li>
                <li><Link to="/contact" className="hover:text-[#D4B982] transition-colors s-link">{t('footer.officesDesks')}</Link></li>
              </ul>
            </div>

            {/* 05. CONTACT */}
            <div data-reveal="up">
              <span className="font-tech text-xs tracking-wider uppercase text-white font-extrabold block mb-3.5">
                {t('footer.contact')}
              </span>
              <div className="space-y-1.5 text-xs text-white/80 leading-relaxed font-medium">
                <a href={`mailto:${settings.primaryEmail}`} className="block break-words hover:text-white transition-colors">
                  {`${emailLocal}@`}<wbr />{emailDomain}
                </a>
                <span className="block text-white/70">
                  {settings.footerLocation}
                </span>
                <Link
                  to="/contact"
                  className="mt-3 text-[11px] font-tech text-[#D4B982] hover:text-white underline underline-offset-2 block"
                >
                  {t('footer.directInquiryDesk')}
                </Link>
              </div>
            </div>

          </div>

        </div>

        {/* Divider draws across once the footer comes into view */}
        <div data-reveal="line" className="h-px bg-white/20" aria-hidden="true" />

        {/* Bottom Sub-bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/70 font-tech">
          <span>
            {settings.copyright}
          </span>
          <div className="flex items-center gap-3">
            {/* Legal pages link once their client-approved content is published; until then the
                approved behaviour (open the inquiry form) is kept. */}
            {hasPage('privacy') ? (
              <Link to="/privacy" className="hover:text-white transition-colors">
                {t('footer.privacyPolicy')}
              </Link>
            ) : (
              <button
                onClick={() => onOpenProjectModal(topicUi('footer.privacyPolicy'))}
                className="hover:text-white transition-colors cursor-pointer"
              >
                {t('footer.privacyPolicy')}
              </button>
            )}
            <span className="text-white/40">|</span>
            {hasPage('terms') ? (
              <Link to="/terms" className="hover:text-white transition-colors">
                {t('footer.termsOfUse')}
              </Link>
            ) : (
              <button
                onClick={() => onOpenProjectModal(topicUi('footer.termsOfUse'))}
                className="hover:text-white transition-colors cursor-pointer"
              >
                {t('footer.termsOfUse')}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
