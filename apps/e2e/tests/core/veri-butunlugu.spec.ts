import { expect, test } from '@playwright/test';
import { API, Fixture, uniqueName } from './coreApi.js';

/**
 * Uçtan uca QA turunda bulunan veri bütünlüğü ve güvenlik hatalarının regresyonu.
 * Hepsi API seviyesinde sınanır; arayüz karşılıkları manuel-run.spec.ts'de.
 */
test.describe('@core veri bütünlüğü ve güvenlik', () => {
  let fx: Fixture;
  test.beforeEach(({ page }) => {
    fx = new Fixture(page.request);
  });
  test.afterEach(async () => {
    await fx.cleanup();
  });

  test('geçmişi olan test case silinemez, geçmiş run değişmez', async ({ page }) => {
    const c = await fx.testCase(uniqueName('QA-E2E silinmez case'));
    const suite = await fx.suite(uniqueName('QA-E2E suite'), [c.id]);
    const run = await fx.run(suite.id);
    await page.request.patch(`${API}/test-runs/${run.id}/results/${c.id}`, { data: { status: 'FAIL' } });
    await page.request.patch(`${API}/test-runs/${run.id}`, { data: { status: 'COMPLETED' } });

    const del = await page.request.delete(`${API}/test-cases/${c.id}`);
    expect(del.status()).toBe(409);
    expect((await del.json()).error).toContain('run sonucunda');

    const after = await (await page.request.get(`${API}/test-runs/${run.id}`)).json();
    expect(after.total).toBe(1);
    expect(after.counts.FAIL).toBe(1);
  });

  test('run geçmişi olan suite silinemez; geçmişsiz suite silinir', async ({ page }) => {
    const c = await fx.testCase(uniqueName('QA-E2E case'));
    const withRun = await fx.suite(uniqueName('QA-E2E run-li suite'), [c.id]);
    const run = await fx.run(withRun.id);

    const blocked = await page.request.delete(`${API}/test-suites/${withRun.id}`);
    expect(blocked.status()).toBe(409);
    expect((await page.request.get(`${API}/test-runs/${run.id}`)).status()).toBe(200);

    const empty = await fx.suite(uniqueName('QA-E2E boş suite'), [c.id]);
    expect((await page.request.delete(`${API}/test-suites/${empty.id}`)).status()).toBe(204);
  });

  test('sıralamada yinelenen case id reddedilir', async ({ page }) => {
    const a = await fx.testCase(uniqueName('QA-E2E a'));
    const b = await fx.testCase(uniqueName('QA-E2E b'));
    const d = await fx.testCase(uniqueName('QA-E2E d'));
    const suite = await fx.suite(uniqueName('QA-E2E sıra'), [a.id, b.id, d.id]);

    const res = await page.request.put(`${API}/test-suites/${suite.id}/cases/order`, {
      data: { caseIds: [a.id, a.id, b.id] },
    });
    expect(res.status()).toBe(400);

    const orders = (await (await page.request.get(`${API}/test-suites/${suite.id}`)).json()).cases.map(
      (x: { order: number }) => x.order,
    );
    expect(orders).toEqual([0, 1, 2]);
  });

  test('HTML içeren "görüntü" yüklenemez, sahte uzantı sunulmaz', async ({ page }) => {
    const c = await fx.testCase(uniqueName('QA-E2E yükleme'));
    const run = await fx.run((await fx.suite(uniqueName('QA-E2E yükleme'), [c.id])).id);
    const url = `${API}/test-runs/${run.id}/results/${c.id}/screenshot`;

    const html = await page.request.post(url, {
      multipart: {
        screenshot: { name: 'x.html', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') },
      },
    });
    expect(html.status()).toBe(400);

    // Gerçek PNG ama .html adıyla: kabul edilir, fakat .png olarak saklanıp sunulur.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const ok = await page.request.post(url, {
      multipart: { screenshot: { name: 'x.html', mimeType: 'image/png', buffer: png } },
    });
    expect(ok.status()).toBe(201);
    const shot: string = (await ok.json()).results[0].screenshotUrl;
    expect(shot).toMatch(/\.png$/);

    const served = await page.request.get(`${API}${shot}`);
    expect(served.headers()['content-type']).toContain('image/png');
    expect(served.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('CSV dışa aktarımında formül nötrlenir', async ({ page }) => {
    const c = await fx.testCase(uniqueName('QA-E2E csv'));
    const run = await fx.run((await fx.suite(uniqueName('QA-E2E csv'), [c.id])).id);
    await page.request.patch(`${API}/test-runs/${run.id}/results/${c.id}`, {
      data: { notes: '=HYPERLINK("http://ornek.invalid","tıkla")' },
    });

    const csv = await (await page.request.get(`${API}/test-runs/${run.id}/export.csv`)).text();
    expect(csv).toContain(`"'=HYPERLINK(`);
    expect(csv).not.toMatch(/;"?=HYPERLINK/);
  });

  test('bozuk JSON 400 döner', async ({ page }) => {
    const res = await page.request.post(`${API}/test-cases`, {
      headers: { 'content-type': 'application/json' },
      data: '{bozuk',
    });
    expect(res.status()).toBe(400);
  });

  test('arama Türkçe harflerde büyük/küçük duyarsız, etiketler tekil', async ({ page }) => {
    const title = uniqueName('QA-E2E Çıkış İşlemi');
    const c = await fx.testCase(title, { tags: ['Çıkış', 'çıkış', 'regresyon'] });
    expect(c.tags).toEqual(['Çıkış', 'regresyon']);

    const res = await page.request.get(`${API}/test-cases?q=${encodeURIComponent('çıkış işlemi')}`);
    const ids = (await res.json()).map((x: { id: string }) => x.id);
    expect(ids).toContain(c.id);
  });
});
