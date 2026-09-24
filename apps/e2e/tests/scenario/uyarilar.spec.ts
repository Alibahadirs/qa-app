import { expect, test } from '@playwright/test';
import { startDemoSite, type DemoSite } from './demoSite.js';
import {
  createScenario,
  deleteScenarioByName,
  discover,
  uniqueName,
  writeScenarioText,
} from './helpers.js';

test.describe.configure({ timeout: 120_000 });

test.describe('@senaryo uyarılar', () => {
  let site: DemoSite;
  // Her test kendi senaryosunu kurar; adlar çakışırsa liste bağlantısı belirsizleşir.
  const katalogName = uniqueName('E2E uyarı katalog');
  const dogrulamaName = uniqueName('E2E uyarı doğrulama');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(katalogName);
    await deleteScenarioByName(dogrulamaName);
    await site.close();
  });

  test('katalogda olmayan hedef, çıkış yolunu gösteren bir hata verir', async ({ page }) => {
    await createScenario(page, katalogName, site.url);
    await discover(page, site.url);

    // "Çıkış" panel sayfasında; henüz taranmadığı için katalogda yok.
    await writeScenarioText(page, [`git: ${site.url}`, 'dogrula: gorunur = Çıkış']);

    const hata = page.getByText(/Katalogda böyle bir element yok/);
    await expect(hata).toBeVisible();
    await expect(hata).toContainText('Sayfayı tara');
  });

  test('doğrulaması olmayan senaryo uyarı ve rozet taşır', async ({ page }) => {
    await createScenario(page, dogrulamaName, site.url);
    await discover(page, site.url);

    // Sadece tıklayan senaryo yalnızca "çökmedi"yi ölçer (ilke 3).
    await writeScenarioText(page, [`git: ${site.url}`, 'tikla: Giriş yap']);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    const uyari = page.getByRole('alert').filter({ hasText: 'hiç doğrulama adımı yok' });
    await expect(uyari).toBeVisible();
    // Nötr bilgi değil, uyarı: sarı zemin.
    await expect(uyari).toHaveClass(/amber/);

    await page.goto('/scenarios');
    const satir = page.locator('li', { has: page.getByRole('link', { name: dogrulamaName }) });
    await expect(satir.getByText('⚠ doğrulama yok')).toBeVisible();
  });
});
