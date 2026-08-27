import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // O Fastify serve /public como estatico (ver src/server.ts).
    outDir: '../public',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      // Em dev a UI roda no Vite e a API no Fastify.
      '/api': 'http://localhost:3000',
    },
  },
});
