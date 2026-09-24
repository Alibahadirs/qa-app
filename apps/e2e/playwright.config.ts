import { defineConfig } from '@playwright/test';

/**
 * Otomatize test case'leri backend tarafından tetiklenir:
 *   npx playwright test <playwrightScriptPath> --reporter=json
 * Bu yüzden reporter burada sabitlenmez; CLI'dan gelen kazanır.
 */
export default defineConfig({
  testDir: './tests',
  // Auth açıksa bir kez giriş yapılır; kapalıysa hiçbir şey yapmaz.
  globalSetup: './tests/globalSetup.ts',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    ...(process.env.E2E_AUTH_PASSWORD
      ? { storageState: 'playwright/.auth/state.json' }
      : {}),
    screenshot: 'only-on-failure',
    // Tarayıcıların önceden kurulu olduğu ortamlar (CI imajı, Docker) için
    // opsiyonel override; boşsa Playwright kendi indirdiği tarayıcıyı kullanır.
    ...(process.env.E2E_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
      : {}),
  },
});
