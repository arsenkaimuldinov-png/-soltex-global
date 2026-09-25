import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { DEFAULT_LOCALE, isLocale } from './i18n/config';
import { loadDictionary } from './i18n/dictionaries';
import { localeFromLocation } from './i18n/paths';
import { readStoredLocale } from './i18n/I18nProvider';

// Returning visitors who explicitly chose a language land on it when they open the site root.
// Only the bare root is redirected — every other URL (including all English URLs) is served as-is.
const stored = readStoredLocale();
if (window.location.pathname === '/' && isLocale(stored ?? undefined) && stored !== DEFAULT_LOCALE) {
  window.history.replaceState(null, '', `/${stored}${window.location.search}${window.location.hash}`);
}

// Load the page's dictionary before the first render so translated pages never flash English.
loadDictionary(localeFromLocation())
  .catch(() => undefined)
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
