import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    nodePolyfills({ include: ['util'] }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MD to PPTX',
        short_name: 'md-pptx',
        description: 'Converta Markdown em apresentações PowerPoint no browser',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: []
      }
    })
  ],
  optimizeDeps: {
    include: ['pptxgenjs']
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          marp: ['@marp-team/marp-core'],
          pptx: ['pptxgenjs'],
          editor: ['codemirror', '@codemirror/lang-markdown', '@codemirror/theme-one-dark']
        }
      }
    }
  }
})
