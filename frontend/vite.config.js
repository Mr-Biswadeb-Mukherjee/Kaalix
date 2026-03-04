import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 1000,
  },

  server: {
    host: true,
    port: 5173,

    // ✅ Add this
    allowedHosts: [
      'doe-settled-eminently.ngrok-free.app'
    ],

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        ws: true,
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
})