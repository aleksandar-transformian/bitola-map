import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Кратко име на commit-от — оди во извештајот од бенчмаркот (src/perf/bench.js).
let commit = null;
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  // без git (на пр. архива) — извештајот нема commit
}

// base: './' — сајтот работи и на GitHub Pages под /bitola-map/ и локално.
export default defineConfig({
  base: './',
  define: { __COMMIT__: JSON.stringify(commit) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: { host: '127.0.0.1', port: 5173 },
});
