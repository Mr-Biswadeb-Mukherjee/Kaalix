import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,

    // 🧠 Proxy for backend API requests
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:6000', // Express backend
        changeOrigin: true,
        secure: false,
        // Optional: rewrite '/api' prefix if your backend doesn't expect it
        // rewrite: path => path.replace(/^\/api/, '')
      }
    },

    // 🌀 File watcher customization
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
