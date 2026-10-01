import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from '../i18n/Link';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { LOCALES } from '../i18n/config';
import { usePresence } from '../motion/usePresence';
import type { UiKey } from '../i18n/bundles';
import { useContent } from '../content/useContent';

/** Main navigation (approved architecture). */
const NAV_ITEMS: { to: string; label: UiKey }[] = [
  { to: '/company', label: 'nav.about' },
  { to: '/technologies', label: 'nav.technologies' },
  { to: '/epcm', label: 'nav.epcm' },
  { to: '/products', label: 'nav.products' },
  { to: '/projects', label: 'nav.projects' },
  { to: '/contact', label: 'nav.contact' },
];


interface NavbarProps {
  onOpenProjectModal: (preselectedTopic?: string) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenProjectModal,
}) => {
  const { t, info, path, switchLocale } = useI18n();
  const { settings } = useContent();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const activeIdx = NAV_ITEMS.findIndex((item) => path === item.to || path.startsWith(item.to + '/'));
  const menu = usePresence(mobileMenuOpen || null, 220);

  // Sliding indicator under the desktop navigation: rests on the current section and
  // follows the pointer. GPU-only (translate + scaleX of a 1px bar); re-measured when text
  // widths change (language switch, font load, resize).
  useLayoutEffect(() => {
    const place = () => {
      const nav = navRef.current;
      const bar = indicatorRef.current;
      if (!nav || !bar) return;
      const idx = hoverIdx ?? activeIdx;
      const link = idx >= 0 ? (nav.querySelectorAll('a')[idx] as HTMLElement | undefined) : undefined;
      if (!link || link.offsetWidth === 0) {
        bar.style.opacity = '0';
        return;
      }
      const wasHidden = bar.style.opacity !== '1';
      if (wasHidden) bar.style.transition = 'none';
      bar.style.transform = `translateX(${link.offsetLeft}px) scaleX(${link.offsetWidth})`;
      bar.style.opacity = '1';
      if (wasHidden) {
        void bar.offsetWidth;
        bar.style.transition = '';
      }
    };
    place();
    window.addEventListener('resize', place);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => window.removeEventListener('resize', place);
  }, [hoverIdx, activeIdx, info.code]);

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
      className={`site-header fixed top-0 inset-x-0 z-40 transition-all duration-200 ${
        isScrolled
          ? 'bg-[#FBFBF8]/96 backdrop-blur-md border-b border-[#16211B]/12 py-3 shadow-xs'
          : 'bg-[#FBFBF8] border-b border-[#16211B]/10 py-4'
      }`}
    >
      {/* Route hairline: sweeps once under the header on every page change */}
      <span key={path} className="route-line is-running" aria-hidden="true" />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          
          {/* Left: Official Soltex Global Logo */}
          <Link
            to="/"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E482C]"
            aria-label={t('common.homeLinkLabel')}
          >
            {/* 44px on phones (keeps logo + language + menu inside 320px), 50px from sm up */}
            <img
              src={settings.logo.src}
              alt={t('common.logoAlt')}
              width={1280}
              height={440}
              className="block h-[44px] sm:h-[50px] w-auto max-w-none object-contain"
              loading="eager"
            />
          </Link>

          {/* Center: Main Navigation Links — Approved Architecture Only */}
          <nav
            ref={navRef}
            onMouseLeave={() => setHoverIdx(null)}
            className="relative hidden xl:flex items-center gap-7 2xl:gap-8 text-[11px] 2xl:text-xs font-bold tracking-wider uppercase font-tech text-[#223328]"
          >
            {NAV_ITEMS.map((item, idx) => (
              <Link
                key={item.to}
                to={item.to}
                onMouseEnter={() => setHoverIdx(idx)}
                onFocus={() => setHoverIdx(idx)}
                onBlur={() => setHoverIdx(null)}
                aria-current={idx === activeIdx ? 'page' : undefined}
                className={`hover:text-[#0E482C] transition-colors py-1 ${idx === activeIdx ? 'text-[#0E482C]' : ''}`}
              >
                {t(item.label)}
              </Link>
            ))}
            <span ref={indicatorRef} className="nav-indicator" aria-hidden="true" />
          </nav>

          {/* Right: Primary Action + Language Selector */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Primary Action Button */}
            <button
              onClick={() => onOpenProjectModal()}
              className="hidden sm:inline-flex items-center justify-center px-4 sm:px-5 py-2.5 bg-[#0E482C] text-white text-[10.5px] sm:text-[11px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors shadow-xs rounded-none cursor-pointer s-btn"
            >
              <span>{t('common.startYourProject')}</span>
            </button>

            {/* Language Selector: Globe EN ▾ */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                aria-haspopup="true"
                aria-expanded={langDropdownOpen}
                className="flex items-center gap-1 min-h-[40px] text-[11px] font-tech font-bold text-[#35473C] hover:text-[#0E482C] px-2 py-1 transition-colors border border-transparent hover:border-[#16211B]/15 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0E482C]"
                aria-label={t('header.changeLanguage')}
              >
                <Globe className="w-3.5 h-3.5 text-[#0E482C]" />
                <span>{info.label}</span>
                <ChevronDown className="w-2.5 h-2.5 text-[#7C8F83]" />
              </button>

              {langDropdownOpen && (
                <div className="s-menu absolute end-0 mt-1.5 w-24 bg-white border border-[#16211B]/15 shadow-lg py-1 z-50 font-tech text-xs">
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
                      className={`w-full text-start px-3 py-2.5 sm:py-1.5 hover:bg-beige-soft transition-colors ${
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
              aria-label={t('header.toggleNavigation')}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer — items settle in one after another; closes with a short fade */}
      {menu.item && (
        <nav
          id="mobile-navigation"
          aria-label={t('header.toggleNavigation')}
          className={`s-menu xl:hidden bg-[#FBFBF8] border-b border-[#16211B]/15 px-4 sm:px-6 pt-3 pb-6 font-tech text-xs font-bold uppercase tracking-wider space-y-1 max-h-[calc(100dvh-80px)] overflow-y-auto overscroll-contain ${
            menu.exiting ? 'is-exiting' : ''
          }`}
        >
          {NAV_ITEMS.map((item, idx) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={idx === activeIdx ? 'page' : undefined}
              style={{ '--i': idx } as React.CSSProperties}
              className={`block py-3 hover:text-[#0E482C] ${idx === activeIdx ? 'text-[#0E482C]' : 'text-[#111814]'}`}
            >
              {t(item.label)}
            </Link>
          ))}
          {/* The header CTA is hidden below sm; keep it reachable from the menu */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenProjectModal();
            }}
            style={{ '--i': NAV_ITEMS.length } as React.CSSProperties}
            className="sm:hidden mt-3 w-full inline-flex items-center justify-center px-5 py-3.5 bg-[#0E482C] text-white text-[11px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors s-btn"
          >
            {t('common.startYourProject')}
          </button>
        </nav>
      )}
    </header>
  );
};
