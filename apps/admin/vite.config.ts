import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Admin SPA. Served in production from https://admin.soltexglobal.co together with /api/v1
// (same origin, no CORS; see docs/admin-architecture-approved.md §10).
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
