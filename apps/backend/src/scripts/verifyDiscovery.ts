/**
 * Faz 7A doğrulaması — "üretilen seçicilerin hepsi Playwright ile tek tek denenir
 * ve o elementi bulduğu kanıtlanır" (CLAUDE.md).
 *
 * fixtures/discovery-demo.html sayfasını yerel bir sunucudan yayınlar, keşfi çalıştırır
 * ve keşiften **bağımsız** yeni bir tarayıcı oturumunda her adayı tek tek dener:
 * her aday tek eşleşme vermeli ve hepsi aynı `data-truth` elementine işaret etmeli.
 *
 * Çalıştırma: pnpm --filter @qa-app/backend test
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { discoverPage } from '../lib/discovery/discover.js';
import { buildLocator, describeCandidate } from '../lib/discovery/selectors.js';

const HTML = readFileSync(join(import.meta.dirname, 'fixtures/discovery-demo.html'), 'utf8');

/** Seçici üretiminde elenmesi gereken, otomatik üretilmiş görünen jetonlar. */
const FORBIDDEN_TOKENS = ['css-1x2y3z', '_a8f3', 'Button_root__9k2x'];

const failures: string[] = [];
const fail = (message: string) => {
  failures.push(message);
  console.error(`  ✗ ${message}`);
};

async function main(): Promise<void> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('Sunucu adresi alınamadı');
  const url = `http://127.0.0.1:${address.port}/`;

  try {
    const elements = await discoverPage(url);
    console.log(`Keşfedilen element: ${elements.length}\n`);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const truths = new Set<string>();

    for (const element of elements) {
      console.log(`${element.label} [${element.role}/${element.tagName}]`);
      let elementTruth: string | null = null;

      for (const candidate of element.candidateSelectors) {
        const shown = describeCandidate(candidate);

        for (const token of FORBIDDEN_TOKENS) {
          if (shown.includes(token)) {
            fail(`Üretilmiş görünen jeton elenmemiş: ${shown}`);
          }
        }

        const locator = buildLocator(page, candidate);
        const count = await locator.count();
        if (count !== 1) {
          fail(`${shown} → ${count} eşleşme (tam olarak 1 olmalı)`);
          continue;
        }

        const truth = await locator.getAttribute('data-truth');
        if (!truth) {
          fail(`${shown} → beklenen elementin dışında bir düğümü buldu`);
          continue;
        }
        if (elementTruth === null) elementTruth = truth;
        else if (elementTruth !== truth) {
          fail(`${shown} → farklı element (${truth}, beklenen ${elementTruth})`);
          continue;
        }
        console.log(`  ✓ ${shown}`);
      }

      if (elementTruth === null) {
        fail(`${element.label}: doğrulanmış tek bir aday bile yok`);
      } else if (truths.has(elementTruth)) {
        fail(`${elementTruth} iki ayrı element kaydına düşmüş`);
      } else {
        truths.add(elementTruth);
      }
    }

    // Aynı metinli iki "Sil" butonu ayrı ayrı hedeflenebilmeli.
    for (const expected of ['sil-1', 'sil-2', 'menu-btn', 'eposta-input', 'unuttum-btn', 'giris-btn']) {
      if (!truths.has(expected)) fail(`Beklenen element kataloğa girmemiş: ${expected}`);
    }

    await browser.close();
  } finally {
    server.close();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} doğrulama hatası.`);
    process.exit(1);
  }
  console.log('\nTüm aday seçiciler doğrulandı.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
