import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {leadFlagsFromEnv} from './src/services/leads/flags';

export default defineConfig(() => {
  // Lead form switches (Phase K-2, src/services/leads/flags.ts), inlined as constants so that code
  // behind an off switch is removed from the bundle.
  const leads = leadFlagsFromEnv(process.env);
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __SOLTEX_LEADS_ENDPOINT__: JSON.stringify(leads.endpoint),
      __SOLTEX_ATTRIBUTION__: JSON.stringify(leads.attribution),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
