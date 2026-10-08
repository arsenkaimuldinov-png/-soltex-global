import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Admin SPA. Served in production from https://admin.soltexglobal.co together with /api/v1
// (same origin, no CORS; see docs/admin-architecture-approved.md §10).
// Development and preview proxy /api to the local API, so the browser sees one origin
// (open http://localhost:3001 — the API's default ADMIN_ORIGIN — not 127.0.0.1).
const API = process.env.ADMIN_API_PROXY ?? 'http://127.0.0.1:3100';
const proxy = { '/api': { target: API, changeOrigin: false, xfwd: true } };

/** The Content-Security-Policy nginx must send for the admin (docs/admin-ui.md §8); preview uses it too. */
export const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: false },
  server: { proxy },
  preview: {
    proxy,
    headers: {
      'Content-Security-Policy': ADMIN_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    },
  },
});
