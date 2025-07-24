import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true, // avoid native FS watchers
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
