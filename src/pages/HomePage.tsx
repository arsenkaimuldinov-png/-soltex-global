import React from 'react';
import type { InquiryTopic } from '../services/leads/topics';
import { Hero } from '../components/Hero';
import { MetricRibbon } from '../components/MetricRibbon';
import { KeyDirections } from '../components/KeyDirections';
import { EpcmStages } from '../components/EpcmStages';
import { VideoBlock } from '../components/VideoBlock';
import { IntellectualProperty } from '../components/IntellectualProperty';

interface HomePageProps {
  onOpenProjectModal: (topic?: InquiryTopic) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenProjectModal,
}) => {
  return (
    <main className="flex-1">
      {/* 01. HERO / PROJECT INTRODUCTION */}
      <Hero
        onOpenProjectModal={() => onOpenProjectModal()}
      />

      {/* 02. INDUSTRIAL METRIC RIBBON (Dedicated Clean Full-Width Section) */}
      <MetricRibbon />

      {/* 03. TECHNOLOGIES FOR HIGH-VALUE INGREDIENTS (6-Card Visual Grid) */}
      <KeyDirections onSelectTechnology={(ref) => onOpenProjectModal({ ref })} />

      {/* 04. FROM CONCEPT TO COMMERCIAL PRODUCTION (approved 8-stage EPCM sequence from EPCM_STAGES) */}
      <EpcmStages onOpenProjectModal={(stage) => onOpenProjectModal(stage)} />

      {/* 05. VIDEO MATERIALS (two Soltex presentation videos + All Projects card) */}
      <VideoBlock />

      {/* 06. TECHNOLOGY & INTELLECTUAL PROPERTY (4 Patent Cards) */}
      <IntellectualProperty
        onOpenProjectModal={(topic) => onOpenProjectModal(topic)}
      />
    </main>
  );
};
