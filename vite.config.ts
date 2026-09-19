import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      globals: true,
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        // Proxy API calls to the FastAPI backend so the browser only ever
        // talks to the same origin (no CORS / preflight issues in dev).
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // Live CCTV MJPEG stream endpoint.
        '/video_feed': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // Local-dev MediaMTX gateway (on-site host tunnels/ports).
        // Production HLS URLs come from the backend /api/cctv/streams
        // response as absolute URLs, so this proxy is dev-only.
        '/hls': {
          target: 'http://127.0.0.1:8888',
          changeOrigin: true,
        },
      },
    },
  }
})
