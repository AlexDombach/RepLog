import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * `base` must match where the app is served from.
 *  - GitHub Pages project site: '/RepLog/'  (default below)
 *  - Root domain / Netlify / Vercel / local LAN preview at root: set BASE_PATH=/
 * Example: BASE_PATH=/ npm run build
 */
const base = process.env.BASE_PATH ?? '/RepLog/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.png'],
      manifest: {
        name: 'RepLog — Workout Tracker',
        short_name: 'RepLog',
        description: 'Offline-first workout tracker. All data stays on your device.',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        // Explicit id helps iOS/Android identify this as one installable app
        // rather than re-deriving it from start_url on every visit.
        id: base,
        // Absolute paths: relative ones resolve against the manifest URL, which
        // is fine here but breaks the moment the manifest moves.
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app shell so it runs with zero network.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Lets you exercise the SW during `npm run dev` on localhost.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
})
