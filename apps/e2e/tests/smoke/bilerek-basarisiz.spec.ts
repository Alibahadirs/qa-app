import { expect, test } from '@playwright/test';

/**
 * Kasıtlı olarak başarısız olan örnek: otomasyon entegrasyonunun FAIL
 * durumunu ve hata çıktısını doğru işlediğini göstermek için.
 */
test('suite sayfasında olmayan bir metin aranıyor @demo', async ({ page }) => {
  await page.goto('/test-suites');
  await expect(page.getByText('BÖYLE BİR METİN YOK')).toBeVisible({ timeout: 3000 });
});
