import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';

/**
 * Kimlik doğrulama açıkken (`AUTH_PASSWORD` tanımlı) testler giriş ekranında takılır.
 * Burada bir kez giriş yapılır ve oturum `storageState` olarak saklanır; tüm testler
 * onu kullanır.
 *
 * Parola `E2E_AUTH_PASSWORD` ile verilir. Tanımlı değilse hiçbir şey yapılmaz —
 * auth kapalı kurulumlar (ve CI'ın mevcut hâli) aynen çalışmaya devam eder.
 */
export const STORAGE_STATE = 'playwright/.auth/state.json';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const password = process.env.E2E_AUTH_PASSWORD;
  if (!password) return;

  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5173';

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL });
    await page.goto('/');

    // Auth kapalıysa giriş formu hiç çıkmaz; o durumda boş bir oturum saklamak yeterli.
    const field = page.getByTestId('login-password');
    if (await field.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await field.fill(password);
      await page.getByTestId('login-submit').click();
      await page.getByRole('heading', { name: 'Genel Bakış' }).waitFor({ timeout: 30_000 });
    }

    mkdirSync(dirname(STORAGE_STATE), { recursive: true });
    await page.context().storageState({ path: STORAGE_STATE });
  } finally {
    await browser.close();
  }
}
