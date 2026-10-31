import { execSync } from 'node:child_process';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Die Versionsnummer im Menü zeigt den Commit, damit klar ist, welcher Stand läuft. */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'lokal';
  }
}

export default defineConfig({
  // GitHub Pages liefert unter /<repo>/ aus; der Workflow setzt BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  define: {
    __COMMIT__: JSON.stringify(commit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Diebesgut',
        short_name: 'Diebesgut',
        description: 'Ein-Finger-Plattformer mit Fallen-Dungeons – Solo-Testversion',
        lang: 'de',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0b0f1c',
        theme_color: '#0b0f1c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
  server: { host: true },
});
