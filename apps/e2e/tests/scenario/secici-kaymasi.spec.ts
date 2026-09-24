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

test.describe.configure({ timeout: 180_000 });

/**
 * Ürünün en değerli davranışı: sayfa değiştiğinde senaryo yedek seçiciyle ayakta kalır,
 * ama bunu sessizce yapmaz — kaymayı hem adım raporunda hem dashboard'da bildirir.
 */
test.describe('@senaryo seçici kayması', () => {
  let site: DemoSite;
  const name = uniqueName('E2E kayma');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await site.close();
  });

  test('buton adı değişince senaryo geçer ama kayma raporlanır', async ({ page }) => {
    await createScenario(page, name, site.url);
    await discover(page, site.url);
    await discover(page, `${site.url}panel`);

    await writeScenarioText(page, [
      `git: ${site.url}`,
      'tikla: Giriş yap',
      'dogrula: metin = Hoş geldiniz',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    const ilk = await runScenario(page);
    await expect(ilk).toContainText('3/3 adım geçti');
    await expect(ilk).toContainText('0 seçici kayması');

    // Sayfa değişir: butonun görünen adı başkalaşır, data-testid'i kalır.
    site.setDrift(true);

    await page.reload();
    const ikinci = await runScenario(page);
    await expect(ikinci).toContainText('3/3 adım geçti');
    await expect(ikinci).toContainText('1 seçici kayması');
    await expect(ikinci).toContainText('Seçici kayması');
    await expect(ikinci).toContainText('2. aday ile bulundu');

    // Kayma tek bir rapora gömülü kalmaz: dashboard toplu olarak gösterir.
    await page.goto('/');
    const kart = page.getByTestId('dash-drift');
    await expect(kart).toBeVisible();
    await expect(kart).toContainText(name);
    await expect(kart).toContainText('tikla: Giriş yap');
  });
});
