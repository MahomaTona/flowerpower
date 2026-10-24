import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' damit die App unter https://<user>.github.io/<repo>/ funktioniert
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false, // eigene Manifeste in public/ (normal + diskret)
      workbox: {
        // Schriften nur in lateinischen Zeichensätzen vorhalten, der Rest bleibt online
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/*-latin-*.woff2'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
