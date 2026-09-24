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

/** Senaryo çalıştırmak sunucu tarafında ayrı bir tarayıcı açar; varsayılan 30 sn yetmez. */
test.describe.configure({ timeout: 180_000 });

test.describe('@senaryo kodsuz senaryo akışı', () => {
  let site: DemoSite;
  const name = uniqueName('E2E akış');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await site.close();
  });

  test('senaryo kurulur, çalıştırılır ve adım adım raporlanır', async ({ page }) => {
    await createScenario(page, name, site.url);

    // İki sayfa da kataloglanır: doğrulama adımlarının hedefleri panelde.
    await discover(page, site.url);
    await discover(page, `${site.url}panel`);
    await expect(page.getByText('Giriş yap', { exact: true })).toBeVisible();

    await writeScenarioText(page, [
      `git: ${site.url}`,
      'yaz: E-posta = test@ornek.com',
      'yaz: Şifre = gizli123',
      'tikla: Giriş yap',
      'bekle: url içerir /panel',
      'dogrula: metin = Hoş geldiniz',
      'dogrula: gorunur = Çıkış',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    // Çift yönlü yazım: metinden gelen adımlar form editöründe de duruyor (ilke: kayıpsızlık).
    await page.getByRole('button', { name: 'Form görünümü' }).click();
    await expect(page.getByLabel('Adım 1 tipi')).toBeVisible();
    await expect(page.getByLabel('Adım 7 tipi')).toBeVisible();

    const report = await runScenario(page);
    await expect(report).toContainText('7/7 adım geçti');
    await expect(report).toContainText('0 seçici kayması');
    await expect(report.getByText('Başarısız')).toHaveCount(0);

    const history = page.locator('section', {
      has: page.getByRole('heading', { name: 'Çalıştırma geçmişi' }),
    });
    await expect(history).toContainText('7 adım · 0 başarısız');
  });
});
