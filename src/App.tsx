import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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

  return (
    <PageTransition key={location.pathname}>
      <Routes location={location}>
        {/* 1. HOME (Preserved exactly as approved) */}
        <Route
          path="/"
          element={
            <HomePage
              onOpenProjectModal={onOpenProjectModal}
              onOpenVideo={onOpenVideo}
            />
          }
        />

        {/* 2. ABOUT */}
        <Route
          path="/company"
          element={
            <AboutPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 3. GLOBAL PRESENCE */}
        <Route
          path="/company/global-presence"
          element={
            <GlobalPresencePage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 4. TECHNOLOGIES INDEX */}
        <Route
          path="/technologies"
          element={
            <TechnologiesPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 5. PATENTS / IP */}
        <Route
          path="/technologies/patents"
          element={
            <PatentsPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 6. TECHNOLOGY DETAIL TEMPLATE */}
        <Route
          path="/technologies/:slug"
          element={
            <TechnologyDetailPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 7. EPCM SERVICES */}
        <Route
          path="/epcm"
          element={
            <EpcmPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 8. PRODUCTS INDEX */}
        <Route
          path="/products"
          element={
            <ProductsPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 9. PRODUCT DETAIL TEMPLATE */}
        <Route
          path="/products/:slug"
          element={
            <ProductDetailPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 10. PROJECTS INDEX */}
        <Route
          path="/projects"
          element={
            <ProjectsPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 11. PROJECT DETAIL TEMPLATE */}
        <Route
          path="/projects/:slug"
          element={
            <ProjectDetailPage
              onOpenProjectModal={onOpenProjectModal}
            />
          }
        />

        {/* 12. CONTACT */}
        <Route
          path="/contact"
          element={
            <ContactPage />
          }
        />

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
    </BrowserRouter>
  );
}
