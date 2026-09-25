import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Globe, ChevronDown, Menu, X } from 'lucide-react';

interface NavbarProps {
  onOpenProjectModal: (preselectedTopic?: string) => void;
  onOpenAbout?: () => void;
  onOpenContact?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenProjectModal,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<'EN' | 'DE' | 'RU'>('EN');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
            className="focus-visible:outline-none"
            style={{ overflow: 'visible', flexShrink: 0, whiteSpace: 'nowrap' }}
            aria-label="Soltex Global Home"
          >
            <img
              src="/images/soltex-global-logo.png"
              alt="Soltex Global"
              style={{
                height: '50px',
                width: 'auto',
                maxWidth: 'none',
                objectFit: 'contain',
                display: 'block',
              }}
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
              ABOUT
            </Link>

            {/* 2. TECHNOLOGIES */}
            <Link
              to="/technologies"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              TECHNOLOGIES
            </Link>

            {/* 3. EPC / EPCM */}
            <Link
              to="/epcm"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              EPC / EPCM
            </Link>

            {/* 4. PRODUCTS */}
            <Link
              to="/products"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              PRODUCTS
            </Link>

            {/* 5. PROJECTS */}
            <Link
              to="/projects"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              PROJECTS
            </Link>

            {/* 6. CONTACT */}
            <Link
              to="/contact"
              className="hover:text-[#0E482C] transition-colors py-1"
            >
              CONTACT
            </Link>
          </nav>

          {/* Right: Primary Action + Language Selector */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Primary Action Button */}
            <button
              onClick={() => onOpenProjectModal()}
              className="inline-flex items-center justify-center px-4 sm:px-5 py-2.5 bg-[#0E482C] text-white text-[10.5px] sm:text-[11px] font-bold tracking-wider uppercase font-tech hover:bg-[#0A3620] transition-colors shadow-xs rounded-none cursor-pointer"
            >
              <span>START YOUR PROJECT</span>
            </button>

            {/* Language Selector: Globe EN ▾ */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="flex items-center gap-1 text-[11px] font-tech font-bold text-[#35473C] hover:text-[#0E482C] px-2 py-1 transition-colors border border-transparent hover:border-[#16211B]/15 cursor-pointer"
                aria-label="Change language"
              >
                <Globe className="w-3.5 h-3.5 text-[#0E482C]" />
                <span>{currentLang}</span>
                <ChevronDown className="w-2.5 h-2.5 text-[#7C8F83]" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-24 bg-white border border-[#16211B]/15 shadow-lg py-1 z-50 font-tech text-xs">
                  {(['EN', 'DE', 'RU'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setCurrentLang(lang);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[#F3F3EC] transition-colors ${
                        currentLang === lang ? 'text-[#0E482C] font-bold bg-[#0E482C]/5' : 'text-[#4E5E55]'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 text-[#111814] hover:text-[#0E482C]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#FBFBF8] border-b border-[#16211B]/15 px-4 pt-3 pb-6 font-tech text-xs font-bold uppercase tracking-wider space-y-3">
          <Link
            to="/company"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            ABOUT
          </Link>
          <Link
            to="/technologies"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            TECHNOLOGIES
          </Link>
          <Link
            to="/epcm"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            EPC / EPCM
          </Link>
          <Link
            to="/products"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            PRODUCTS
          </Link>
          <Link
            to="/projects"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            PROJECTS
          </Link>
          <Link
            to="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[#111814] hover:text-[#0E482C]"
          >
            CONTACT
          </Link>
        </div>
      )}
    </header>
  );
};
