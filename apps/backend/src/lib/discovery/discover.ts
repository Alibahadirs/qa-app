import { createHash } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import { HttpError } from '../errors.js';
import { MARKER_ATTRIBUTE, extractElements } from './extract.js';
import { buildCandidates, buildLocator } from './selectors.js';
import type { DiscoveredElement, RawElement, SelectorCandidate } from './types.js';

const NAVIGATION_TIMEOUT_MS = 30_000;
/** Sayfa yüklendikten sonra geç gelen içerik için kısa bekleme. */
const SETTLE_MS = 1_000;

/**
 * `extractElements`'i sayfada çalıştırılacak kaynak metne çevirir.
 *
 * Fonksiyonu doğrudan `page.evaluate`'e vermek yerine metne çeviriyoruz: tsx/esbuild
 * geliştirme modunda fonksiyon gövdesine `__name(...)` yardımcı çağrıları enjekte eder
 * ve bu yardımcı tarayıcıda tanımsızdır. Kaynağı kendi kapsamında saran IIFE, `__name`'i
 * yerel olarak tanımlayarak sayfaya hiçbir global sızdırmadan sorunu çözer.
 */
function extractSource(): string {
  return `(() => {
    const __name = (fn) => fn;
    return (${extractElements.toString()})(${JSON.stringify(MARKER_ATTRIBUTE)});
  })()`;
}

/**
 * Elementin sayfa yeniden kataloglandığında da aynı kalan kimliği.
 * İçeriğe (rol + ad + testid) dayanır; DOM konumu değişse bile korunur.
 */
function elementKey(raw: RawElement): string {
  const basis = [raw.role, raw.accessibleName, raw.testId ?? '', raw.tagName].join('|');
  const stable = raw.accessibleName || raw.testId ? basis : `${basis}|${raw.cssPath}`;
  return createHash('sha1').update(stable).digest('hex').slice(0, 16);
}

/**
 * Bir adayın gerçekten **o** elementi bulduğunu kanıtlar: sayfada tek eşleşme
 * vermeli ve eşleşen element aranan işareti taşımalı. Kanıtlanamayan aday atılır.
 */
async function verifyCandidate(
  page: Page,
  candidate: SelectorCandidate,
  eid: string,
): Promise<boolean> {
  try {
    const locator = buildLocator(page, candidate);
    if ((await locator.count()) !== 1) return false;
    const marker = await locator.getAttribute(MARKER_ATTRIBUTE, { timeout: 2_000 });
    return marker === eid;
  } catch {
    return false;
  }
}

/**
 * Açık bir sayfayı kataloglar. Senaryo çalışırken yeni bir sayfaya geçildiğinde de
 * kullanılır (tasarım ilkesi 4: element keşfi süreklidir) — ayrı tarayıcı açmaz.
 */
export async function discoverOnPage(page: Page): Promise<DiscoveredElement[]> {
  const rawElements = (await page.evaluate(extractSource())) as RawElement[];

  const discovered: DiscoveredElement[] = [];
  const seenKeys = new Set<string>();

  for (const raw of rawElements) {
    const verified: SelectorCandidate[] = [];
    for (const candidate of buildCandidates(raw)) {
      if (await verifyCandidate(page, candidate, raw.eid)) verified.push(candidate);
    }
    // Hiçbir aday kanıtlanamadıysa element hedeflenemez; kataloğa alınmaz.
    if (verified.length === 0) continue;

    let key = elementKey(raw);
    // Aynı sayfada birebir aynı sinyallere sahip iki element olabilir.
    if (seenKeys.has(key)) key = `${key}-${discovered.length}`;
    seenKeys.add(key);

    discovered.push({
      key,
      label: raw.accessibleName || raw.placeholder || raw.text || raw.tagName,
      role: raw.role,
      tagName: raw.tagName,
      candidateSelectors: verified,
    });
  }

  // Sayfaya yazılan geçici işaretleri temizle (DOM'u bulduğumuz gibi bırak).
  await page.evaluate((attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  }, MARKER_ATTRIBUTE);

  return discovered;
}

/** Verilen URL'i yeni bir tarayıcıda açar ve kataloglar. */
export async function discoverPage(url: string): Promise<DiscoveredElement[]> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    } catch (err) {
      throw new HttpError(400, `Sayfa açılamadı: ${(err as Error).message}`);
    }
    await page.waitForTimeout(SETTLE_MS);
    return await discoverOnPage(page);
  } finally {
    await browser.close();
  }
}
