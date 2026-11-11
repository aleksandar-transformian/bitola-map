import { defineConfig } from 'vite';

// base: './' — сајтот работи и на GitHub Pages под /bitola-map/ и локално.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: { host: '127.0.0.1', port: 5173 },
});
