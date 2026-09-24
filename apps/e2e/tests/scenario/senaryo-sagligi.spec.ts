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

test.describe.configure({ mode: 'serial', timeout: 180_000 });

/**
 * Faz 8D — zamanlanmış koşular arka planda çalıştığı için kimse bakmadan da düşebilir.
 * Başarısızlığın senaryo detayına girmeden görünmesi gerekiyor: dashboard'da,
 * senaryo listesinde ve zamanlanmış koşular sayfasında.
 */
test.describe('@senaryo senaryo sağlığı', () => {
  let site: DemoSite;
  const name = uniqueName('E2E sağlık');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await site.close();
  });

  test('başarısız senaryo dashboard ve listede görünür', async ({ page }) => {
    await createScenario(page, name, site.url);
    await discover(page, site.url);

    // Bilerek tutmayan bir doğrulama: sayfada böyle bir metin yok.
    await writeScenarioText(page, [
      `git: ${site.url}`,
      'dogrula: metin = Bu metin sayfada yok',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    const report = await runScenario(page);
    await expect(report).toContainText('Başarısız');

    // Dashboard: senaryo detayına girmeden görülebilmeli.
    await page.goto('/');
    const kart = page.getByTestId('dash-failing');
    await expect(kart).toBeVisible();
    const satir = kart.locator('li', { hasText: name });
    await expect(satir).toBeVisible();
    // Nerede düştüğü de yazmalı, yalnızca "başarısız" değil.
    await expect(satir).toContainText('dogrula: metin = Bu metin sayfada yok');
    await expect(satir).toContainText('Chromium');

    // Senaryo listesi: son koşunun durumu satırda.
    await page.goto('/scenarios');
    const listeSatiri = page.locator('li', { has: page.getByRole('link', { name }) });
    await expect(listeSatiri).toContainText('Başarısız');
  });

  test('zamanlanmış koşular sayfası açık zamanlamaları sıralar', async ({ page }) => {
    await page.goto('/scenarios');
    await page.getByRole('link', { name }).click();

    await page.getByLabel('Zamanlama biçimi').selectOption('DAILY');
    await page.getByLabel('Saat').fill('23:30');
    await page.getByLabel('Zamanlama tarayıcısı').selectOption('FIREFOX');
    await page.getByTestId('save-schedule').click();
    await expect(page.getByText('Zamanlama kaydedildi.')).toBeVisible();

    await page.goto('/scenarios/schedules');
    const satir = page.getByTestId('schedule-rows').locator('li', { hasText: name });
    await expect(satir).toBeVisible();
    await expect(satir).toContainText('her gün 23:30');
    await expect(satir).toContainText('Firefox');
    await expect(satir).toContainText('sıradaki:');

    // Kapatılan zamanlama bu listede yer almaz.
    await page.goto('/scenarios');
    await page.getByRole('link', { name }).click();
    await page.getByLabel('Zamanlama açık').uncheck();
    await page.getByTestId('save-schedule').click();
    await expect(page.getByText('Zamanlama kaydedildi.')).toBeVisible();

    await page.goto('/scenarios/schedules');
    await expect(page.locator('li', { hasText: name })).toHaveCount(0);
  });
});
