import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all network interfaces (0.0.0.0)
    port: 3001,
    allowedHosts: [
      'for.dareesoft.ai' // add your hostname here
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Split map libraries into separate chunks
          'maplibre': ['maplibre-gl'],
          'deckgl': ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/react'],
          // Vendor chunk for React ecosystem
          'vendor': ['react', 'react-dom', 'zustand', '@tanstack/react-query'],
          // Map components (loaded on demand)
          'maps': ['react-map-gl'],
        },
      },
    },
    // Increase chunk size warning limit since we're now properly splitting
    chunkSizeWarningLimit: 600,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
    exclude: ['maplibre-gl'], // Let it be bundled separately
  },
})
