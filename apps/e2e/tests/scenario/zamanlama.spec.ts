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

/**
 * Zamanlayıcının **tetiklenmesi** backend doğrulamasında (verifyScheduler.ts) gerçek
 * veritabanına karşı kanıtlanıyor; burada arayüz tarafı sınanıyor: zamanlama kurulabiliyor,
 * okunabiliyor, kaldırılabiliyor ve adımı olmayan senaryoda kapalı.
 */
test.describe('@senaryo zamanlama', () => {
  let site: DemoSite;
  const name = uniqueName('E2E zamanlama');
  const bosName = uniqueName('E2E zamanlama boş');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    await deleteScenarioByName(name);
    await deleteScenarioByName(bosName);
    await site.close();
  });

  test('zamanlama kurulur, okunur ve kaldırılır', async ({ page }) => {
    await createScenario(page, name, site.url);
    await discover(page, site.url);
    await writeScenarioText(page, [`git: ${site.url}`, 'dogrula: metin = Demo Mağaza']);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    await expect(page.getByText('Bu senaryo zamanlanmamış.')).toBeVisible();

    await page.getByLabel('Zamanlama biçimi').selectOption('INTERVAL');
    await page.getByLabel('Dakika').fill('30');
    await page.getByTestId('save-schedule').click();
    await expect(page.getByText('Zamanlama kaydedildi.')).toBeVisible();

    const ozet = page.getByTestId('schedule-summary');
    await expect(ozet).toContainText('her 30 dakikada bir');
    await expect(ozet).toContainText('sıradaki:');

    // Günlük biçime geçiş: diğer biçimin alanı anlamını yitirir.
    await page.getByLabel('Zamanlama biçimi').selectOption('DAILY');
    await page.getByLabel('Saat').fill('07:45');
    await page.getByTestId('save-schedule').click();
    await expect(page.getByText('Zamanlama kaydedildi.')).toBeVisible();
    await expect(ozet).toContainText('her gün 07:45');

    // Kapatmak silmekle aynı şey değil: kayıt durur, tetiklenmez.
    await page.getByLabel('Zamanlama açık').uncheck();
    await page.getByTestId('save-schedule').click();
    await expect(ozet).toContainText('(kapalı)');

    // Sayfa yeniden yüklenince editör kayıtlı değerleri gösterir.
    await page.reload();
    await expect(page.getByLabel('Zamanlama biçimi')).toHaveValue('DAILY');
    await expect(page.getByLabel('Saat')).toHaveValue('07:45');
    await expect(page.getByLabel('Zamanlama açık')).not.toBeChecked();

    await page.getByRole('button', { name: 'Kaldır' }).click();
    await expect(page.getByText('Zamanlama kaldırıldı.')).toBeVisible();
    await expect(page.getByText('Bu senaryo zamanlanmamış.')).toBeVisible();
  });

  test('adımı olmayan senaryo zamanlanamaz', async ({ page }) => {
    await createScenario(page, bosName, site.url);
    const kaydet = page.getByTestId('save-schedule');
    await expect(kaydet).toBeDisabled();
    await expect(kaydet).toHaveAttribute('title', 'Adımı olmayan senaryo zamanlanamaz');
  });
});
