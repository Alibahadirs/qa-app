import { expect, test } from '@playwright/test';
import { API, Fixture, uniqueName } from './coreApi.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('@core manuel test run', () => {
  let fx: Fixture;
  test.beforeEach(({ page }) => {
    fx = new Fixture(page.request);
  });
  test.afterEach(async () => {
    await fx.cleanup();
  });

  test('run başlatılır, işaretlenir, tamamlanır ve yeniden başlatılır', async ({ page }) => {
    const first = await fx.testCase(uniqueName('QA-E2E ilk case'));
    const second = await fx.testCase(uniqueName('QA-E2E ikinci case'));
    const suite = await fx.suite(uniqueName('QA-E2E manuel suite'), [first.id, second.id]);

    // ?suiteId ile gelince suite hazır seçilir ve buton basılabilir olur.
    await page.goto(`/test-runs/new?suiteId=${suite.id}`);
    await expect(page.getByTestId('run-suite')).toHaveValue(suite.id);
    await page.getByTestId('run-start').click();
    await page.waitForURL(/\/test-runs\/(?!new)[^/?]+$/);
    const runId = page.url().split('/').pop() as string;
    fx.track('runs', runId);

    await page.getByTestId('run-notes').fill('Buton geç yükleniyor');
    await page.getByTestId('run-notes').blur();
    await page.getByTestId('run-screenshot-input').setInputFiles({
      name: 'kanit.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByTestId('run-screenshot')).toBeAttached();

    // İşaretleme sıradaki bekleyen case'e geçirir.
    await page.getByTestId('mark-FAIL').click();
    await expect(page.getByTestId('run-active-case')).toContainText('QA-E2E ikinci case');

    await page.getByTestId('mark-PASS').click();
    await page.getByTestId('mark-reset').click();

    await page.getByTestId('run-case-0').click();
    await expect(page.getByTestId('run-notes')).toHaveValue('Buton geç yükleniyor');

    let dialog = '';
    page.once('dialog', (d) => {
      dialog = d.message();
      void d.accept();
    });
    await page.getByTestId('run-complete').click();
    await expect(page.getByTestId('run-restart')).toBeVisible();
    expect(dialog).toContain('1 case hâlâ işaretlenmemiş');
    await expect(page.getByTestId('mark-PASS')).toHaveCount(0);

    const run = await (await page.request.get(`${API}/test-runs/${runId}`)).json();
    expect(run.status).toBe('COMPLETED');
    expect(run.counts).toMatchObject({ FAIL: 1, NOT_RUN: 1 });

    await page.getByTestId('run-restart').click();
    await expect(page).toHaveURL(new RegExp(`/test-runs/new\\?suiteId=${suite.id}$`));
    await expect(page.getByTestId('run-start')).toBeEnabled();
  });

  test('run geçmişi olan suite silinince arayüz nedenini gösterir', async ({ page }) => {
    const c = await fx.testCase(uniqueName('QA-E2E case'));
    const suite = await fx.suite(uniqueName('QA-E2E silinmeyen suite'), [c.id]);
    await fx.run(suite.id);

    await page.goto(`/test-suites/${suite.id}`);
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: "Suite'i sil" }).click();
    await expect(page.getByRole('alert')).toContainText('run geçmişi de kaybolur');
    await expect(page).toHaveURL(new RegExp(`/test-suites/${suite.id}$`));
  });

  test('dar ekranda yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ['/dashboard', '/test-cases', '/test-runs']) {
      await page.goto(path);
      await expect(page.locator('header nav')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${path} yatay taşıyor`).toBeLessThanOrEqual(1);
    }
  });
});
