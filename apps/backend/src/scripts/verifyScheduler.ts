/**
 * Faz 8B doğrulaması — zamanlayıcının dört davranışı:
 *
 *   1. `computeNextRun` her zaman ileri bir zaman üretir (aynı ana denk gelen zamanlama
 *      bir sonraki tura kayar, yoksa tick sonsuz döngüye girer).
 *   2. Zamanı gelmiş zamanlama gerçekten çalışır ve koşu SCHEDULED olarak işaretlenir.
 *   3. Zamanı gelmemiş ya da kapalı zamanlama çalışmaz.
 *   4. Senaryo zaten çalışıyorsa zamanlayıcı üstüne binmez, ama zamanı ileri alır.
 *
 * Geliştirme veritabanına yazar ve sonunda oluşturduğu her şeyi siler.
 * Çalıştırma: pnpm --filter @qa-app/backend test
 */
import { createServer } from 'node:http';
import { prisma } from '../db.js';
import { saveDiscoveredElements, normalizeUrl } from '../lib/discovery/catalog.js';
import { discoverPage } from '../lib/discovery/discover.js';
import { computeNextRun, parseDailyAt, runDueSchedules } from '../lib/scenario/scheduler.js';
import { acquireRun, releaseRun } from '../lib/scenario/running.js';
import { parseScenarioText } from '../lib/scenario/text.js';

const page = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>Zamanlama</title></head><body>
  <h1>Hoş geldiniz</h1>
  <button data-testid="tikla">Tıkla</button>
</body></html>`;

const failures: string[] = [];
const check = (ok: boolean, message: string) => {
  if (ok) console.log(`  ✓ ${message}`);
  else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
};

async function main(): Promise<void> {
  console.log('1) sonraki çalıştırma zamanı');

  const base = new Date('2026-03-10T08:30:00');
  check(
    computeNextRun({ kind: 'INTERVAL', intervalMinutes: 15, dailyAt: null }, base).getTime() ===
      base.getTime() + 15 * 60_000,
    'INTERVAL: verilen dakika kadar ileri',
  );

  const laterToday = computeNextRun({ kind: 'DAILY', intervalMinutes: null, dailyAt: '09:00' }, base);
  check(
    laterToday.getHours() === 9 && laterToday.getDate() === base.getDate(),
    'DAILY: saat henüz geçmemişse bugün',
  );

  const tomorrow = computeNextRun({ kind: 'DAILY', intervalMinutes: null, dailyAt: '08:00' }, base);
  check(
    tomorrow.getHours() === 8 && tomorrow.getDate() === base.getDate() + 1,
    'DAILY: saat geçmişse yarın',
  );

  const exactly = computeNextRun({ kind: 'DAILY', intervalMinutes: null, dailyAt: '08:30' }, base);
  check(exactly.getTime() > base.getTime(), 'DAILY: tam o ana denk gelirse yarına kayar');

  check(parseDailyAt('24:00') === null && parseDailyAt('9:00') === null, 'bozuk saat reddedilir');

  // ---- gerçek bir senaryo kurulur ----
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) throw new Error('Sunucu adresi alınamadı');
  const baseUrl = `http://127.0.0.1:${address.port}/`;

  const scenario = await prisma.scenario.create({
    data: { name: '8B doğrulama senaryosu', baseUrl },
  });

  try {
    const pageUrl = normalizeUrl(baseUrl);
    const saved = await saveDiscoveredElements(
      pageUrl,
      scenario.id,
      await discoverPage(pageUrl),
    );
    const elements = saved.map((e) => ({ id: e.id, label: e.label }));
    const parsed = parseScenarioText(
      [`git: ${baseUrl}`, 'dogrula: metin = Hoş geldiniz'].join('\n'),
      elements,
    );
    if (parsed.errors.length > 0) throw new Error(JSON.stringify(parsed.errors));
    await prisma.scenarioStep.createMany({
      data: parsed.steps.map((s, i) => ({ ...s, scenarioId: scenario.id, order: i })),
    });

    console.log('\n2) zamanı gelmiş zamanlama çalışır');
    const past = new Date(Date.now() - 60_000);
    await prisma.scenarioSchedule.create({
      data: {
        scenarioId: scenario.id,
        kind: 'INTERVAL',
        intervalMinutes: 15,
        nextRunAt: past,
      },
    });

    const started = await runDueSchedules();
    check(started === 1, 'bir zamanlama çalıştırıldı');

    const runs = await prisma.scenarioRun.findMany({ where: { scenarioId: scenario.id } });
    check(runs.length === 1, 'tek bir koşu oluştu');
    check(runs[0]?.trigger === 'SCHEDULED', 'koşu SCHEDULED olarak işaretlendi');
    check(runs[0]?.status === 'PASS', `koşu geçti (${runs[0]?.status})`);

    const after = await prisma.scenarioSchedule.findUniqueOrThrow({
      where: { scenarioId: scenario.id },
    });
    check(after.nextRunAt.getTime() > Date.now(), 'sıradaki zaman ileri alındı');
    check(after.lastRunAt !== null, 'son çalıştırma zamanı yazıldı');

    console.log('\n3) zamanı gelmemiş ve kapalı zamanlama çalışmaz');
    check((await runDueSchedules()) === 0, 'zamanı gelmemiş zamanlama atlandı');

    await prisma.scenarioSchedule.update({
      where: { scenarioId: scenario.id },
      data: { enabled: false, nextRunAt: past },
    });
    check((await runDueSchedules()) === 0, 'kapalı zamanlama atlandı');

    console.log('\n4) süren bir çalıştırmanın üstüne binmez');
    await prisma.scenarioSchedule.update({
      where: { scenarioId: scenario.id },
      data: { enabled: true, nextRunAt: past },
    });

    acquireRun(scenario.id);
    const skipped = await runDueSchedules();
    releaseRun(scenario.id);
    check(skipped === 0, 'süren koşu varken yeni koşu başlatılmadı');

    const total = await prisma.scenarioRun.count({ where: { scenarioId: scenario.id } });
    check(total === 1, 'fazladan koşu oluşmadı');

    const moved = await prisma.scenarioSchedule.findUniqueOrThrow({
      where: { scenarioId: scenario.id },
    });
    check(moved.nextRunAt.getTime() > Date.now(), 'atlansa da zaman ileri alındı');
  } finally {
    await prisma.scenario.delete({ where: { id: scenario.id } });
    server.close();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} doğrulama başarısız.`);
    process.exit(1);
  }
  console.log('\nZamanlayıcı doğrulandı.');
}

await main();
await prisma.$disconnect();
