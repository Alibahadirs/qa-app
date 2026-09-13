import { expect, test } from '@playwright/test';

test('test case listesi yükleniyor ve filtre çalışıyor', async ({ page }) => {
  await page.goto('/test-cases');
  await expect(page.getByRole('heading', { name: "Test Case'ler" })).toBeVisible();
  await expect(page.locator('[data-testid="case-rows"] tr').first()).toBeVisible();

  await page.selectOption('[data-testid="filter-priority"]', 'CRITICAL');
  await expect(page.locator('[data-testid="case-rows"] tr')).toHaveCount(1);
});
