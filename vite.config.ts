/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// BASE lets the same build serve from a sub-path (e.g. GitHub Pages: /drum-coach/)
export default defineConfig({
  base: process.env.BASE ?? '/',
  define: {
    __BUILD__: JSON.stringify(`${new Date().toISOString().slice(0, 16)} ${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}`),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'onset-processor.js'],
      manifest: {
        name: 'Drum Coach',
        short_name: 'Drum Coach',
        description: 'Limb independence and rudiments practice with spaced repetition',
        theme_color: '#0e0f12',
        background_color: '#0e0f12',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
