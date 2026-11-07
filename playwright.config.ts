import { defineConfig, devices } from '@playwright/test'

// Las pruebas levantan su propio servidor, en otros puertos y con la base en
// memoria: nunca tocan los datos reales del local.
const PUERTO_WEB = 5180
const PUERTO_API = 5181

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'node scripts/dev.mjs',
    url: `http://localhost:${PUERTO_WEB}/api/salud`,
    reuseExistingServer: false,
    env: {
      CO_PUERTO_WEB: String(PUERTO_WEB),
      CO_PUERTO_API: String(PUERTO_API),
      CO_DB_RUTA: ':memory:',
    },
  },
})
