import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nProvider';
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

// Modals
import { ProjectInquiryModal } from './components/ProjectInquiryModal';
import { VideoModal } from './components/VideoModal';
import { ContactModal } from './components/ContactModal';
import { VideoMaterial } from './types';

interface AppRoutesProps {
  onOpenProjectModal: (topic?: string) => void;
  onOpenVideo: (video: VideoMaterial) => void;
}

function AppRoutes({ onOpenProjectModal, onOpenVideo }: AppRoutesProps) {
  const location = useLocation();

  // Every page exists in every language: English at its original URL (/company),
  // other languages under a prefix (/ru/company). One route table, no duplicated pages.
  const pages: { path: string; element: React.ReactNode }[] = [
    { path: '/', element: <HomePage onOpenProjectModal={onOpenProjectModal} onOpenVideo={onOpenVideo} /> },
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
  ];

  return (
    <PageTransition key={splitLocalePath(location.pathname).path}>
      <Routes location={location}>
        {LOCALES.flatMap((l) =>
          pages.map((page) => (
            <Route key={`${l.code}:${page.path}`} path={localizePath(page.path, l.code)} element={page.element} />
          ))
        )}

        {/* Fallback */}
        <Route
          path="*"
          element={
            <HomePage
              onOpenProjectModal={onOpenProjectModal}
              onOpenVideo={onOpenVideo}
            />
          }
        />
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedTechForInquiry, setSelectedTechForInquiry] = useState<string>('Pectin & Dietary Fibers');
  const [activeVideo, setActiveVideo] = useState<VideoMaterial | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const handleOpenProjectModal = (preselectedTech?: string) => {
    if (preselectedTech) {
      setSelectedTechForInquiry(preselectedTech);
    }
    setProjectModalOpen(true);
  };

  const handleOpenVideo = (video: VideoMaterial) => {
    setActiveVideo(video);
    setVideoModalOpen(true);
  };

  return (
    <BrowserRouter>
      <I18nProvider>
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
            onOpenVideo={handleOpenVideo}
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
          preselectedTopic={selectedTechForInquiry}
        />

        {/* Video Presentation Modal */}
        <VideoModal
          isOpen={videoModalOpen}
          onClose={() => {
            setVideoModalOpen(false);
            setActiveVideo(null);
          }}
          video={activeVideo}
        />

        {/* Quick Contact Modal (Simplified to Name + Phone) */}
        <ContactModal
          isOpen={contactModalOpen}
          onClose={() => setContactModalOpen(false)}
          onOpenProjectModal={(topic) => handleOpenProjectModal(topic)}
        />
      </div>
      </I18nProvider>
    </BrowserRouter>
  );
}
