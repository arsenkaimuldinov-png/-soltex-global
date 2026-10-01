import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { SeoHead } from './i18n/SeoHead';
import { LOCALES } from './i18n/config';
import { localizePath, splitLocalePath } from './i18n/paths';
import { ScrollToTop } from './components/ScrollToTop';
import { PageTransition } from './components/PageTransition';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { GlobalPresencePage } from './pages/GlobalPresencePage';
import { TechnologiesPage } from './pages/TechnologiesPage';
import { TechnologyDetailPage } from './pages/TechnologyDetailPage';
import { PatentsPage } from './pages/PatentsPage';
import { EpcmPage } from './pages/EpcmPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ContactPage } from './pages/ContactPage';
import { LegalPage } from './pages/LegalPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Modals
import { ProjectInquiryModal } from './components/ProjectInquiryModal';
import { topicUi, type InquiryTopic } from './services/leads/topics';

interface AppRoutesProps {
  onOpenProjectModal: (topic?: InquiryTopic) => void;
}

function AppRoutes({ onOpenProjectModal }: AppRoutesProps) {
  const location = useLocation();
  const { content } = useI18n();

  // Every page exists in every language: English at its original URL (/company),
  // other languages under a prefix (/ru/company). One route table, no duplicated pages.
  // Route patterns are code-owned (src/content/routes.ts); content decides what is published.
  const pages: { path: string; element: React.ReactNode }[] = [
    { path: '/', element: <HomePage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/company', element: <AboutPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/company/global-presence', element: <GlobalPresencePage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/technologies', element: <TechnologiesPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/technologies/patents', element: <PatentsPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/technologies/:slug', element: <TechnologyDetailPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/epcm', element: <EpcmPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/products', element: <ProductsPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/products/:slug', element: <ProductDetailPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/projects', element: <ProjectsPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/projects/:slug', element: <ProjectDetailPage onOpenProjectModal={onOpenProjectModal} /> },
    { path: '/contact', element: <ContactPage /> },
    // Legal pages are routed only once their client-approved content is published.
    ...(content.hasPage('privacy') ? [{ path: '/privacy', element: <LegalPage pageKey="privacy" /> }] : []),
    ...(content.hasPage('terms') ? [{ path: '/terms', element: <LegalPage pageKey="terms" /> }] : []),
  ];

  return (
    <PageTransition key={splitLocalePath(location.pathname).path}>
      <Routes location={location}>
        {LOCALES.flatMap((l) =>
          pages.map((page) => (
            <Route key={`${l.code}:${page.path}`} path={localizePath(page.path, l.code)} element={page.element} />
          ))
        )}

        {/* Unknown URL: real "not found" page (served with HTTP 404 by the web server). */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageTransition>
  );
}

/** Everything inside the router. Shared by the browser entry (BrowserRouter) and prerendering (StaticRouter). */
export function AppShell() {
  return (
    <I18nProvider>
      <AppLayout />
    </I18nProvider>
  );
}

const DEFAULT_TOPIC = topicUi('inquiry.defaultTopic');

function AppLayout() {
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  // The topic is a language-independent descriptor (stable keys / IDs); the dialog resolves it
  // in the current language, so switching language never leaves it in the old language.
  const [selectedTopic, setSelectedTopic] = useState<InquiryTopic>(DEFAULT_TOPIC);

  const handleOpenProjectModal = (preselectedTopic?: InquiryTopic) => {
    if (preselectedTopic) {
      setSelectedTopic(preselectedTopic);
    }
    setProjectModalOpen(true);
  };

  return (
    <>
      <SeoHead />
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-[#FBFBF8] text-[#121815] selection:bg-[#0E482C] selection:text-white">
        {/* Top Bar Navigation */}
        <Navbar
          onOpenProjectModal={() => handleOpenProjectModal()}
        />

        <main className="flex-1 flex flex-col">
          <AppRoutes
            onOpenProjectModal={handleOpenProjectModal}
          />
        </main>

        {/* Botanical Green Footer */}
        <Footer
          onOpenProjectModal={(topic) => handleOpenProjectModal(topic)}
        />

        {/* Quick Lead Inquiry Modal (Simplified to Name + Phone) */}
        <ProjectInquiryModal
          isOpen={projectModalOpen}
          onClose={() => setProjectModalOpen(false)}
          preselectedTopic={selectedTopic}
        />
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
