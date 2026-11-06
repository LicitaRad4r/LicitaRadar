import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra a API real: sobe tudo com `docker compose up --build` (front com VITE_API_MOCK=false),
 * roda o seed e só então executa `npx playwright test -c playwright.api-real.config.ts`.
 * Não há webServer aqui de propósito: o ambiente é o do Compose, com emuladores do Firebase.
 */
export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: false, // os cenários mexem nos mesmos dados do seed
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
