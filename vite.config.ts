import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.indexOf('node_modules') !== -1) return undefined
          if (id.indexOf('/node_modules/react/') !== -1 || id.indexOf('/node_modules/react-dom/') !== -1 || id.indexOf('/node_modules/scheduler/') !== -1) return 'vendor-react'
          if (id.indexOf('/node_modules/@supabase/') !== -1) return 'vendor-supabase'
          if (id.indexOf('/node_modules/lucide-react/') !== -1) return 'vendor-icons'
          return 'vendor'
        },
      },
    },
  },
})
