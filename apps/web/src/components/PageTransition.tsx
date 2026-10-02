import React from 'react';
import { useLocation } from 'react-router-dom';
import { splitLocalePath } from '../i18n/paths';
import { useRevealSystem } from '../motion/useRevealSystem';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Page wrapper. Route changes cross-fade through the View Transitions API (see
 * src/i18n/Link.tsx and src/styles/motion.css); browsers without it get the CSS entrance
 * on `.page-transition-enter`. `data-page` scopes the automatic heading/image reveals.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const pagePath = splitLocalePath(location.pathname).path;
  useRevealSystem(pagePath);

  return (
    <div key={pagePath} data-page="" className="page-transition-enter flex-1 flex flex-col">
      {children}
    </div>
  );
};
