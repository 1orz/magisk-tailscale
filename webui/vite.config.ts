import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { devBridge } from './dev/bridge.ts'

export default defineConfig({
  // The root manager serves webroot/ from an arbitrary path.
  base: './',
  plugins: [react(), tailwindcss(), devBridge()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // Dependencies only reached through lazy imports; listing them avoids a
  // re-optimization (and a failed chunk load) the first time they're used.
  optimizeDeps: {
    include: ['recharts', 'shiki/core', 'shiki/engine/javascript'],
  },
  build: {
    // Android System WebView on the oldest devices KernelSU supports.
    target: 'chrome100',
    assetsInlineLimit: 0,
  },
})
