import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
