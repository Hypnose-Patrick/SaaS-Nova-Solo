import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'supabase': ['@supabase/supabase-js', '@supabase/auth-helpers-react'],
          'charts': ['chart.js', 'react-chartjs-2'],
          'date': ['date-fns'],
          'router': ['react-router-dom']
        }
      }
    }
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
