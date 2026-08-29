import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = `http://localhost:${env.PORT || 3101}`

  return {
    plugins: [react()],
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/auth': apiTarget,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
  }
})
