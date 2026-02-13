/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  // GitHub Pages deployment - update this to match your repo name
  base: process.env.GITHUB_PAGES === 'true' 
    ? '/openclaw-universalprofile-skill/' 
    : '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    // Polyfill for viem/ethers compatibility
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Node.js polyfills for browser
      buffer: 'buffer',
    },
  },
})
