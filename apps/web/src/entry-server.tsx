/**
 * Server entry used at BUILD TIME ONLY (scripts/prerender.ts): renders a route to static HTML.
 * The browser entry (src/main.tsx) then hydrates that HTML. No server is needed in production.
 */
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AppShell } from './App';

export function renderRoute(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <AppShell />
      </StaticRouter>
    </StrictMode>
  );
}

export { primeBundle, getBundle } from './i18n/bundles';
