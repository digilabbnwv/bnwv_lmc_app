/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { bouwCsp } from './csp.ts';

// Zet de CSP-meta-tag alleen in de productiebuild. De dev-server van Vite
// gebruikt inline scripts voor hot reload; die zouden door de CSP worden geblokkeerd.
function cspPlugin(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'bnwv-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: bouwCsp(supabaseUrl) },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // GitHub Pages serveert de site onder de reponaam.
    base: command === 'build' ? '/bnwv_lmc_app/' : '/',
    plugins: [react(), cspPlugin(env.VITE_SUPABASE_URL)],
    // De hoofdbundel bevat React, supabase-js en zod (~600 kB, ~170 kB gzip); de beheerschermen
    // worden apart geladen. Daarom ligt de waarschuwingsgrens iets hoger dan de standaard 500 kB.
    build: { sourcemap: false, chunkSizeWarningLimit: 700 },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}', '*.test.ts'],
    },
  };
});
