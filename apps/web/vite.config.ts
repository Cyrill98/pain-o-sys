import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// Read VITE_* variables from the repo-root .env (shared with the API).
const envDir = path.resolve(dirname, '../..');

const SAND = '#f8f4ec';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiPort = env.API_PORT ?? '3000';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Our own service worker (src/sw.ts): offline shell + push notifications.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // Ask before switching to a new version, so nobody loses a half-filled form.
        registerType: 'prompt',
        injectRegister: false,
        // Icons are generated from public/icon.svg (see pwa-assets.config.ts).
        pwaAssets: { config: true, overrideManifestIcons: true },
        manifest: {
          name: 'Painting Quote',
          short_name: 'Paint',
          description:
            'Try paint colors on your walls and request a quote. / Cuba warna cat pada dinding anda dan minta sebut harga.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: SAND,
          theme_color: SAND,
          shortcuts: [
            { name: 'Request a quote', short_name: 'Quote', url: '/request' },
            { name: 'Admin', url: '/admin' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        },
        // The service worker only runs in production builds (`npm run build` + `npm start`).
        devOptions: { enabled: false },
      }),
    ],
    envDir,
    resolve: {
      alias: { '@': path.resolve(dirname, 'src') },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': `http://localhost:${apiPort}`,
      },
    },
  };
});
