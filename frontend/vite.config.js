import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // ✅ Add this block
  build: {
    chunkSizeWarningLimit: 1000, // increase from default 500 kB
  },

  server: {
    host: true,
    port: 5173,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        // rewrite: path => path.replace(/^\/api/, '')
      }
    },

    watch: {
      usePolling: true,
      interval: 150,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/.vscode/**',
        '**/.idea/**',
        '**/.cache/**',
        '**/*.log',
        '**/*.tmp',
        '**/*.DS_Store',
        '**/*.swp'
      ]
    }
  }
});