import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { DEFAULT_LOCALE, isLocale } from './i18n/config';
import { loadBundle } from './i18n/bundles';
import { localeFromLocation } from './i18n/paths';
import { readStoredLocale } from './i18n/I18nProvider';
import { applyMotionClasses, markHydrated } from './motion/prefs';

// Motion system flags on <html> (also set before first paint by the inline boot script in index.html).
applyMotionClasses();

// Returning visitors who explicitly chose a language land on it when they open the site root.
// Only the bare root is redirected — every other URL (including all English URLs) is served as-is.
const stored = readStoredLocale();
let redirected = false;
if (window.location.pathname === '/' && isLocale(stored ?? undefined) && stored !== DEFAULT_LOCALE) {
  window.history.replaceState(null, '', `/${stored}${window.location.search}${window.location.hash}`);
  redirected = true;
}

const container = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Load the page's language bundle (UI strings + content) before the first render so translated
// pages never flash English, then attach to the prerendered HTML (or render it in development).
loadBundle(localeFromLocation())
  .catch(() => undefined)
  .then(() => {
    // The shared "not found" document is served for ANY unknown URL, so it is rendered fresh
    // for the actual URL instead of hydrated (e.g. /projects/<unknown> shows the project
    // section's own "not found" message, exactly as before).
    const notFoundDocument = container.dataset.render === 'not-found';
    if (container.hasChildNodes() && !redirected && !notFoundDocument) {
      hydrateRoot(container, app);
    } else {
      // Development server (empty #root), a not-found document, or the root redirect to a stored language.
      container.textContent = '';
      createRoot(container).render(app);
    }
    markHydrated();
  });
