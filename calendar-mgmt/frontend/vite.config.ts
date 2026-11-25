/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const isInsideDocker = fs.existsSync('/.dockerenv');
const hrProxyTarget = isInsideDocker
  ? process.env.VITE_HR_API_PROXY || 'http://hr-backend:8000'
  : 'http://127.0.0.1:8001';
const calendarProxyTarget = isInsideDocker
  ? process.env.VITE_API_PROXY || 'http://calendar-backend:8000'
  : 'http://127.0.0.1:8002';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: false,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      '/api/hr': {
        target: hrProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hr/, '/api/v1'),
      },
      '/api': {
        target: calendarProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
