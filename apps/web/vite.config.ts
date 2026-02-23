import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          // React core + router
          if (
            id.includes('/react-dom/') ||
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/') ||
            id.includes('/react/')
          ) {
            return 'vendor-react'
          }

          // PixiJS renderer + viewport
          if (id.includes('/pixi.js/') || id.includes('/@pixi/') || id.includes('/pixi-viewport/')) {
            return 'vendor-pixi'
          }

          // TanStack React Query
          if (id.includes('/@tanstack/react-query/') || id.includes('/@tanstack/query-core/')) {
            return 'vendor-query'
          }

          // Geometry / polygon operations
          if (id.includes('/polygon-clipping/')) {
            return 'vendor-geo'
          }

          return undefined
        },
      },
    },
  },
})
