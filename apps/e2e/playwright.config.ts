import { defineConfig } from '@playwright/test';

/**
 * Otomatize test case'leri backend tarafından tetiklenir:
 *   npx playwright test <playwrightScriptPath> --reporter=json
 * Bu yüzden reporter burada sabitlenmez; CLI'dan gelen kazanır.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    // Tarayıcıların önceden kurulu olduğu ortamlar (CI imajı, Docker) için
    // opsiyonel override; boşsa Playwright kendi indirdiği tarayıcıyı kullanır.
    ...(process.env.E2E_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } }
      : {}),
  },
});
