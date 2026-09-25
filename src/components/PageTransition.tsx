import React from 'react';
import { useLocation } from 'react-router-dom';
import { splitLocalePath } from '../i18n/paths';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div key={splitLocalePath(location.pathname).path} className="page-transition-enter flex-1 flex flex-col">
      {children}
    </div>
  );
};
