/**
 * Faz 7C doğrulaması — adım çalıştırıcının üç davranışı gerçek bir tarayıcıda kanıtlanır:
 *
 *   1. Uçtan uca geçen senaryo: adımlar sırayla çalışır, yeni sayfaya geçildiğinde
 *      o sayfa da kendiliğinden kataloglanır (tasarım ilkesi 4).
 *   2. Seçici kayması: sayfa değişip ilk aday tutmadığında adım sıradaki adayla geçer
 *      ve `usedSelectorIndex > 0` ile işaretlenir (tasarım ilkesi 2).
 *   3. Başarısızlık: hatalı adım FAIL olur, ekran görüntüsü alınır, kalan adımlar SKIPPED.
 *
 * Geliştirme veritabanına yazar ve sonunda oluşturduğu her şeyi siler.
 * Çalıştırma: pnpm --filter @qa-app/backend test
 */
import { existsSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { prisma } from '../db.js';
import { saveDiscoveredElements, normalizeUrl } from '../lib/discovery/catalog.js';
import { discoverPage } from '../lib/discovery/discover.js';
import { UPLOAD_DIR } from '../lib/uploads.js';
import { runScenario } from '../lib/scenario/runner.js';
import { parseScenarioText } from '../lib/scenario/text.js';

/** Giriş sayfası. `drift` true olduğunda butonun görünen adı değişir, test id'si kalır. */
const loginPage = (drift: boolean) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Giriş</title></head><body>
  <label for="eposta">E-posta</label><input id="eposta" type="email">
  <label for="sifre">Şifre</label><input id="sifre" type="password">
  <button data-testid="giris" onclick="location.href='/panel'">${drift ? 'Oturum aç' : 'Giriş yap'}</button>
</body></html>`;

const panelPage = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Panel</title></head><body>
  <h1>Hoş geldiniz</h1>
  <button id="cikis">Çıkış</button>
</body></html>`;

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) console.log(`  ✓ ${message}`);
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
};

let drift = false;

async function main(): Promise<void> {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url?.startsWith('/panel') ? panelPage : loginPage(drift));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('Sunucu adresi alınamadı');
  const baseUrl = `http://127.0.0.1:${address.port}/`;

  const scenario = await prisma.scenario.create({
    data: { name: '7C doğrulama senaryosu', baseUrl },
  });
  const screenshots: string[] = [];

  try {
    // Katalog: giriş sayfası senaryoya bağlanır.
    await saveDiscoveredElements(normalizeUrl(baseUrl), scenario.id, await discoverPage(baseUrl));
    const elements = await prisma.pageElement.findMany({
      where: { scenarioId: scenario.id },
      select: { id: true, label: true },
    });
    console.log(`katalog: ${elements.map((e) => e.label).join(', ')}\n`);

    await prisma.scenarioVariable.create({
      data: { scenarioId: scenario.id, name: 'sifre', value: 'gizli123', secret: true },
    });

    const writeSteps = async (text: string) => {
      const parsed = parseScenarioText(text, elements);
      if (parsed.errors.length > 0) {
        console.error(parsed.errors);
        throw new Error('Doğrulama senaryosu ayrıştırılamadı');
      }
      await prisma.scenarioStep.deleteMany({ where: { scenarioId: scenario.id } });
      await prisma.scenarioStep.createMany({
        data: parsed.steps.map((s, i) => ({ ...s, scenarioId: scenario.id, order: i })),
      });
    };

    const loadRun = (id: string) =>
      prisma.scenarioRun.findUniqueOrThrow({
        where: { id },
        include: { steps: { orderBy: { order: 'asc' } } },
      });

    const HAPPY_PATH = [
      'yaz: E-posta = test@ornek.com',
      'yaz: Şifre = {{sifre}}',
      'tikla: Giriş yap',
      'bekle: url içerir /panel',
      'dogrula: metin = Hoş geldiniz',
    ].join('\n');

    console.log('1) uçtan uca geçen senaryo');
    await writeSteps(HAPPY_PATH);
    const first = await loadRun(await runScenario(scenario.id));
    check(first.status === 'PASS', `çalıştırma PASS (${first.status})`);
    check(first.steps.length === 5 && first.steps.every((s) => s.status === 'PASS'), '5 adım geçti');
    if (first.steps.some((s) => s.error)) console.error(first.steps.map((s) => s.error));
    check(
      first.steps.every((s) => (s.usedSelectorIndex ?? 0) === 0),
      'her hedef ilk aday seçiciyle bulundu (kayma yok)',
    );
    const panelElements = await prisma.pageElement.findMany({
      where: { scenarioId: scenario.id, pageUrl: { contains: '/panel' } },
    });
    check(
      panelElements.some((e) => e.label === 'Çıkış'),
      'senaryo yeni sayfaya geçince o sayfa da kataloglandı (ilke 4)',
    );

    console.log('\n2) sayfa değişti: seçici kayması');
    drift = true;
    const second = await loadRun(await runScenario(scenario.id));
    const clickStep = second.steps.find((s) => s.action === 'CLICK');
    check(second.status === 'PASS', `buton adı değişmesine rağmen çalıştırma PASS (${second.status})`);
    check(
      (clickStep?.usedSelectorIndex ?? 0) > 0,
      `tıklama sıradaki adayla geçti (usedSelectorIndex=${clickStep?.usedSelectorIndex})`,
    );
    drift = false;

    console.log('\n3) başarısız adım');
    await writeSteps(
      ['dogrula: metin = Bu metin sayfada yok', 'dogrula: gorunur = E-posta'].join('\n'),
    );
    const third = await loadRun(await runScenario(scenario.id));
    check(third.status === 'FAIL', `çalıştırma FAIL (${third.status})`);
    check(third.steps[0]?.status === 'FAIL', 'hatalı adım FAIL işaretlendi');
    check(Boolean(third.steps[0]?.error), 'hata mesajı kaydedildi');
    check(third.steps[1]?.status === 'SKIPPED', 'hatadan sonraki adım SKIPPED');

    const shot = third.steps[0]?.screenshotPath;
    if (shot) screenshots.push(shot);
    check(Boolean(shot) && existsSync(join(UPLOAD_DIR, shot!)), 'hata anında ekran görüntüsü alındı');
  } finally {
    // Doğrulamanın ürettiği her şeyi geri al.
    await prisma.scenario.delete({ where: { id: scenario.id } }).catch(() => {});
    for (const file of screenshots) {
      try {
        unlinkSync(join(UPLOAD_DIR, file));
      } catch {
        /* dosya zaten yoksa sorun değil */
      }
    }
    server.close();
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} doğrulama hatası.`);
    process.exit(1);
  }
  console.log('\nAdım çalıştırıcı doğrulandı.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
