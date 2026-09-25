import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { splitLocalePath } from '../i18n/paths';

export function ScrollToTop() {
  const { pathname } = useLocation();
  // Switching language keeps the visitor on the same page and scroll position;
  // only a change of page scrolls back to the top.
  const pagePath = splitLocalePath(pathname).path;

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  }, [pagePath]);

  return null;
}
