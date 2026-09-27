import React, { useState, useEffect, useRef } from 'react';
import { Link } from '../i18n/Link';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { LOCALES } from '../i18n/config';

interface NavbarProps {
  onOpenProjectModal: (preselectedTopic?: string) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenProjectModal,
}) => {
  const { t, info, path, switchLocale } = useI18n();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the mobile menu whenever the page changes (links, back/forward, language switch)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
        isScrolled
          ? 'bg-[#FBFBF8]/96 backdrop-blur-md border-b border-[#16211B]/12 py-3 shadow-xs'
          : 'bg-[#FBFBF8] border-b border-[#16211B]/10 py-4'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Official Soltex Global Logo */}
          <Link
            to="/"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E482C]"
            aria-label={t("Soltex Global Home")}
          >
            {/* 44px on phones (keeps logo + language + menu inside 320px), 50px from sm up */}
            <img
              src="/images/soltex-global-logo-transparent.png"
              alt={t("Soltex Global")}
              width={1280}
              height={440}
              className="block h-[44px] sm:h-[50px] w-auto max-w-none object-contain"
              loading="eager"
            />
          </Link>

          {/* Center: Main Navigation Links — Approved Architecture Only */}
          <nav className="hidden xl:flex items-center gap-7 2xl:gap-8 text-[11px] 2xl:text-xs font-bold tracking-wider uppercase font-tech text-[#223328]">
            
            {/* 1. ABOUT */}
            <Link
              to="/company"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("ABOUT")}
            </Link>

            {/* 2. TECHNOLOGIES */}
            <Link
              to="/technologies"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("TECHNOLOGIES")}
            </Link>

            {/* 3. EPC / EPCM */}
            <Link
              to="/epcm"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("EPC / EPCM")}
            </Link>

            {/* 4. PRODUCTS */}
            <Link
              to="/products"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("PRODUCTS")}
            </Link>

            {/* 5. PROJECTS */}
            <Link
              to="/projects"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("PROJECTS")}
            </Link>

            {/* 6. CONTACT */}
            <Link
              to="/contact"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              {t("CONTACT")}
            </Link>
          </nav>

          {/* Right: Primary Action + Language Selector */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Primary Action Button */}
            <button
              onClick={() => onOpenProjectModal()}
              className="hidden sm:inline-flex items-center justify-center px-4 sm:px-5 py-2.5 bg-[#0E482C] text-white text-[10.5px] sm:text-[11px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors shadow-xs rounded-none cursor-pointer"
            >
              <span>{t("START YOUR PROJECT")}</span>
            </button>

            {/* Language Selector: Globe EN ▾ */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                aria-haspopup="true"
                aria-expanded={langDropdownOpen}
                className="flex items-center gap-1 min-h-[40px] text-[11px] font-tech font-bold text-[#35473C] hover:text-[#0E482C] px-2 py-1 transition-colors border border-transparent hover:border-[#16211B]/15 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0E482C]"
                aria-label={t("Change language")}
              >
                <Globe className="w-3.5 h-3.5 text-[#0E482C]" />
                <span>{info.label}</span>
                <ChevronDown className="w-2.5 h-2.5 text-[#7C8F83]" />
              </button>

              {langDropdownOpen && (
                <div className="absolute end-0 mt-1.5 w-24 bg-white border border-[#16211B]/15 shadow-lg py-1 z-50 font-tech text-xs">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      lang={l.htmlLang}
                      dir={l.dir}
                      aria-current={info.code === l.code ? 'true' : undefined}
                      onClick={() => {
                        setLangDropdownOpen(false);
                        setMobileMenuOpen(false);
                        if (l.code !== info.code) void switchLocale(l.code);
                      }}
                      className={`w-full text-start px-3 py-2.5 sm:py-1.5 hover:bg-[#F3F3EC] transition-colors ${
                        info.code === l.code ? 'text-[#0E482C] font-bold bg-[#0E482C]/5' : 'text-[#4E5E55]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2.5 -me-2.5 text-[#111814] hover:text-[#0E482C] focus-visible:outline-2 focus-visible:outline-[#0E482C]"
              aria-label={t("Toggle Navigation Menu")}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label={t("Toggle Navigation Menu")}
          className="xl:hidden bg-[#FBFBF8] border-b border-[#16211B]/15 px-4 sm:px-6 pt-3 pb-6 font-tech text-xs font-bold uppercase tracking-wider space-y-1 max-h-[calc(100dvh-80px)] overflow-y-auto overscroll-contain"
        >
          <Link
            to="/company"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("ABOUT")}
          </Link>
          <Link
            to="/technologies"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("TECHNOLOGIES")}
          </Link>
          <Link
            to="/epcm"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("EPC / EPCM")}
          </Link>
          <Link
            to="/products"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("PRODUCTS")}
          </Link>
          <Link
            to="/projects"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("PROJECTS")}
          </Link>
          <Link
            to="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-3 text-[#111814] hover:text-[#0E482C]"
          >
            {t("CONTACT")}
          </Link>
          {/* The header CTA is hidden below sm; keep it reachable from the menu */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenProjectModal();
            }}
            className="sm:hidden mt-3 w-full inline-flex items-center justify-center px-5 py-3.5 bg-[#0E482C] text-white text-[11px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors"
          >
            {t("START YOUR PROJECT")}
          </button>
        </nav>
      )}
    </header>
  );
};
