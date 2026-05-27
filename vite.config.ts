import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  resolve: {
    alias: {
      // Add bcryptjs to the list of Node.js built-in modules that Vite should handle
      bcryptjs: 'bcryptjs'
    }
  },
  optimizeDeps: {
    include: ['bcryptjs'] // Include bcryptjs in the dependency optimization
  }
})
