import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works when mounted at /app (or any path)
  base: './',
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the FastAPI backend so the frontend
      // can call /api/... without CORS issues. Browser stays on :5173
      // so HttpOnly session cookies remain first-party; Vite forwards them.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
  },
})
