/// <reference types="vitest/config" />
import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const src = (p: string) => path.resolve(import.meta.dirname, 'src', p)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@app': src('app'),
      '@features': src('features'),
      '@shared': src('shared'),
      '@styles': src('styles'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Local dev without Docker: forward API calls to uvicorn.
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
