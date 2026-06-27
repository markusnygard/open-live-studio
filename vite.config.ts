import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  envPrefix: ['OPEN_LIVE_', 'OSC_'],
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://open-live:8000',
    },
  },
})
