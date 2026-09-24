import { expect, type Page } from '@playwright/test';

/** Temizlik doğrudan API'den yapılır; arayüzden silmek testin konusu değil. */
const API = process.env.E2E_API_URL ?? 'http://localhost:3001';

/** Senaryo adları çakışmasın diye: testler aynı veritabanında yan yana çalışır. */
export const uniqueName = (prefix: string): string =>
  `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** Test sonunda kendi ürettiği senaryoyu siler — CI veritabanı şişmesin. */
export async function deleteScenarioByName(name: string): Promise<void> {
  const response = await fetch(`${API}/scenarios`);
  if (!response.ok) return;
  const body: unknown = await response.json();
  const rows = (Array.isArray(body) ? body : ((body as { data?: unknown[] }).data ?? [])) as {
    id: string;
    name: string;
  }[];
  for (const row of rows.filter((r) => r.name === name)) {
    await fetch(`${API}/scenarios/${row.id}`, { method: 'DELETE' });
  }
}

/** Senaryonun sunucudaki hâli — gizli değerin sızmadığını doğrulamak için. */
export async function fetchScenarioByName(name: string): Promise<{
  id: string;
  variables: { name: string; value: string | null; secret: boolean }[];
} | null> {
  const list: unknown = await (await fetch(`${API}/scenarios`)).json();
  const rows = (Array.isArray(list) ? list : ((list as { data?: unknown[] }).data ?? [])) as {
    id: string;
    name: string;
  }[];
  const found = rows.find((r) => r.name === name);
  if (!found) return null;
  const detail: unknown = await (await fetch(`${API}/scenarios/${found.id}`)).json();
  return (
    (detail as { data?: unknown }).data ?? detail
  ) as Awaited<ReturnType<typeof fetchScenarioByName>>;
}

/** Arayüzden senaryo oluşturur ve detay sayfasını açar. */
export async function createScenario(page: Page, name: string, baseUrl: string): Promise<void> {
  await page.goto('/scenarios');
  await page.getByTestId('new-scenario').click();
  await page.getByLabel('Ad', { exact: true }).fill(name);
  await page.getByRole('textbox', { name: 'Başlangıç adresi' }).fill(baseUrl);
  await page.getByRole('button', { name: 'Oluştur' }).click();

  const link = page.getByRole('link', { name });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

/** Verilen adresi tarayıp senaryonun element kataloğuna ekler. */
export async function discover(page: Page, url: string): Promise<void> {
  await page.getByLabel('Taranacak adres').fill(url);
  await page.getByTestId('discover').click();
  await expect(page.getByText(/element kataloglandı/)).toBeVisible({ timeout: 60_000 });
}

/** Metin görünümüne geçip senaryo metnini yazar ve kaydeder. */
export async function writeScenarioText(page: Page, lines: string[]): Promise<void> {
  const toText = page.getByRole('button', { name: 'Metin görünümü' });
  if (await toText.isVisible()) await toText.click();
  await page.getByLabel('Senaryo metni').fill(lines.join('\n'));
  await page.getByTestId('save-steps').click();
}

/** "▶ Çalıştır" → rapor bölümü. Çalıştırma gerçek tarayıcı açtığı için cömert bekleriz. */
export async function runScenario(page: Page) {
  await page.getByTestId('run-scenario').click();
  const report = page.locator('section', {
    has: page.getByRole('heading', { name: 'Çalıştırma raporu' }),
  });
  await expect(report).toBeVisible({ timeout: 120_000 });
  return report;
}
