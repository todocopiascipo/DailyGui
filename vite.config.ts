/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const puertoWeb = Number(process.env.CO_PUERTO_WEB ?? 5173)
const puertoApi = Number(process.env.CO_PUERTO_API ?? 5174)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: puertoWeb,
    strictPort: true,
    // Accesible desde el iPad y el monitor por la red del local.
    host: true,
    proxy: {
      '/api': `http://127.0.0.1:${puertoApi}`,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    css: false,
  },
})
