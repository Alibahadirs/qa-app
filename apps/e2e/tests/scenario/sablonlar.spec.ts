import { expect, test } from '@playwright/test';
import { startDemoSite, type DemoSite } from './demoSite.js';
import {
  createScenario,
  deleteScenarioByName,
  deleteTemplateByName,
  discover,
  runScenario,
  uniqueName,
  writeScenarioText,
} from './helpers.js';

// İkinci test, birincinin kurduğu şablonu kullanır: sıralı çalışmalı.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

/**
 * Şablon, senaryo gövdesini **etiketlerle** taşır. Aynı etiketleri sunan bir sayfada
 * doğrudan tutar; tutmayan bir sayfada senaryo adımsız kurulur ve metin, satır bazlı
 * hatalarıyla editöre düşer. İki davranışı da sınıyoruz.
 */
test.describe('@senaryo şablonlar', () => {
  let site: DemoSite;
  const kaynakName = uniqueName('E2E şablon kaynak');
  const hedefName = uniqueName('E2E şablon hedef');
  const uymayanName = uniqueName('E2E şablon uymayan');
  const templateName = uniqueName('E2E giriş şablonu');

  test.beforeAll(async () => {
    site = await startDemoSite();
  });

  test.afterAll(async () => {
    for (const name of [kaynakName, hedefName, uymayanName]) await deleteScenarioByName(name);
    await deleteTemplateByName(templateName);
    await site.close();
  });

  test('senaryodan şablon çıkarılır ve uyan bir adreste yeniden kurulur', async ({ page }) => {
    await createScenario(page, kaynakName, site.url);
    await discover(page, site.url);
    await discover(page, `${site.url}panel`);
    await writeScenarioText(page, [
      `git: ${site.url}`,
      'yaz: E-posta = test@ornek.com',
      'tikla: Giriş yap',
      'dogrula: metin = Hoş geldiniz',
    ]);
    await expect(page.getByText('Adımlar kaydedildi.')).toBeVisible();

    // Şablon adı window.prompt ile sorulur.
    page.once('dialog', (dialog) => void dialog.accept(templateName));
    await page.getByTestId('save-as-template').click();
    await expect(page.getByText(`"${templateName}" şablonu kaydedildi.`)).toBeVisible();

    await page.goto('/scenario-templates');
    const satir = page.locator('li', { hasText: templateName });
    await expect(satir).toBeVisible();
    // Şablon adımları değil, taşınabilir metni saklar.
    await expect(satir).toContainText('tikla: Giriş yap');

    await satir.getByRole('button', { name: 'Senaryo kur' }).click();
    await page.getByLabel('Senaryo adı', { exact: true }).fill(hedefName);
    await page.getByRole('textbox', { name: 'Başlangıç adresi' }).fill(site.url);
    await page.getByTestId('apply-template').click();

    // Etiketler tuttu: senaryo adımlarıyla doğar ve doğrudan çalışır.
    await expect(page.getByRole('heading', { name: hedefName })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByLabel('Adım 4 tipi')).toBeVisible();

    const report = await runScenario(page);
    await expect(report).toContainText('4/4 adım geçti');
  });

  test('uymayan bir adreste senaryo adımsız kurulur ve metin editöre düşer', async ({ page }) => {
    await page.goto('/scenario-templates');
    const satir = page.locator('li', { hasText: templateName });
    await satir.getByRole('button', { name: 'Senaryo kur' }).click();
    await page.getByLabel('Senaryo adı', { exact: true }).fill(uymayanName);
    // Panel sayfasında "E-posta" ya da "Giriş yap" etiketleri yok.
    await page.getByRole('textbox', { name: 'Başlangıç adresi' }).fill(`${site.url}panel`);
    await page.getByTestId('apply-template').click();

    await expect(page.getByRole('heading', { name: uymayanName })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText(/Şablon metni bu sayfanın kataloğuna uymadı/)).toBeVisible();

    // Metin kaybolmaz: düzeltilebilsin diye editörde durur, hatalar satır numaralı.
    await expect(page.getByLabel('Senaryo metni')).toContainText('tikla: Giriş yap');
    await expect(page.getByText(/Satır 3:/)).toBeVisible();
    await expect(page.getByText(/Katalogda böyle bir element yok/).first()).toBeVisible();
  });
});
