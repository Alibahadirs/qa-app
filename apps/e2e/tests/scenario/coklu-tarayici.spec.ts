import { expect, test } from '@playwright/test';
import { startDemoSite, type DemoSite } from './demoSite.js';
import {
  createScenario,
  deleteScenarioByName,
  discover,
  runScenario,
  uniqueName,
  writeScenarioText,
} from './helpers.js';

// Üç motor arka arkaya açılır; cömert süre gerekir.
test.describe.configure({ mode: 'serial', timeout: 300_000 });

/**
 * Aynı senaryo üç motorda da koşar. Seçiciler motor bağımsız üretildiği için
 * (getByRole/getByTestId/…) adımlarda hiçbir değişiklik gerekmez — 8C'nin iddiası bu.
 */
test.describe('@senaryo çoklu tarayıcı', () => {
  let site: DemoSite;
  const name = uniqueName('E2E çoklu tarayıcı');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await site.close();
  });

  test('senaryo Chromium, Firefox ve WebKit motorlarında aynı sonucu verir', async ({ page }) => {
    await createScenario(page, name, site.url);
    await discover(page, site.url);
    await discover(page, `${site.url}panel`);
    await writeScenarioText(page, [
      `git: ${site.url}`,
      'yaz: E-posta = test@ornek.com',
      'tikla: Giriş yap',
      'bekle: url içerir /panel',
      'dogrula: metin = Hoş geldiniz',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    for (const [value, label] of [
      ['CHROMIUM', 'Chromium'],
      ['FIREFOX', 'Firefox'],
      ['WEBKIT', 'WebKit'],
    ] as const) {
      await page.getByLabel('Tarayıcı', { exact: true }).selectOption(value);
      const report = await runScenario(page);
      await expect(report).toContainText('5/5 adım geçti');
      // Rapor hangi motorda koştuğunu söyler.
      await expect(report).toContainText(label);
    }

    // Geçmişte üç koşu da durur.
    const history = page.locator('section', {
      has: page.getByRole('heading', { name: 'Çalıştırma geçmişi' }),
    });
    await expect(history.locator('li')).toHaveCount(3);
  });

  test('zamanlama da tarayıcı taşır', async ({ page }) => {
    await page.goto('/scenarios');
    await page.getByRole('link', { name }).click();

    await page.getByLabel('Zamanlama tarayıcısı').selectOption('WEBKIT');
    await page.getByTestId('save-schedule').click();
    await expect(page.getByText('Zamanlama kaydedildi.')).toBeVisible();
    await expect(page.getByTestId('schedule-summary')).toContainText('WebKit');
  });
});
