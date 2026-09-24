import { expect, test } from '@playwright/test';
import { startDemoSite, type DemoSite } from './demoSite.js';
import {
  createScenario,
  deleteScenarioByName,
  discover,
  fetchScenarioByName,
  runScenario,
  uniqueName,
  writeScenarioText,
} from './helpers.js';

test.describe.configure({ timeout: 180_000 });

/** Parola gibi değerler senaryo metnine düz yazılmaz; ayrı bir değişken deposunda tutulur. */
test.describe('@senaryo değişken deposu', () => {
  let site: DemoSite;
  const name = uniqueName('E2E değişken');
  const SECRET = 'cok-gizli-1234';

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await site.close();
  });

  test('gizli değişken kaydedilir, korunur ve hiçbir yerde sızmaz', async ({ page }) => {
    await createScenario(page, name, site.url);
    await discover(page, site.url);
    await discover(page, `${site.url}panel`);

    await writeScenarioText(page, [
      `git: ${site.url}`,
      'yaz: E-posta = test@ornek.com',
      'yaz: Şifre = {{sifre}}',
      'tikla: Giriş yap',
      'dogrula: metin = Hoş geldiniz',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    // Metinde geçen ad, değeri olmasa da satır olarak açılır.
    const bolum = page.locator('section', {
      has: page.getByRole('heading', { name: 'Değişkenler' }),
    });
    await expect(bolum.getByLabel('Değişken 1 adı')).toHaveValue('sifre');

    await bolum.getByLabel('Değişken 1 değeri').fill(SECRET);
    await bolum.getByRole('checkbox').check();
    await page.getByTestId('save-variables').click();
    await expect(page.getByText('Değişkenler kaydedildi.')).toBeVisible();

    // Gizli değer sunucudan istemciye hiç dönmez.
    const kayit = await fetchScenarioByName(name);
    expect(kayit?.variables).toContainEqual({ name: 'sifre', value: null, secret: true });

    // Değeri yeniden yazmadan kaydetmek onu silmemeli: arayüz değeri bilmiyor.
    await page.reload();
    await page.getByTestId('save-variables').click();
    await expect(page.getByText('Değişkenler kaydedildi.')).toBeVisible();

    const report = await runScenario(page);
    await expect(report).toContainText('5/5 adım geçti');
    await expect(report).not.toContainText(SECRET);
  });
});
