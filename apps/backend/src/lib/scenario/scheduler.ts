/**
 * Faz 8B — zamanlanmış senaryo çalıştırma.
 *
 * Dakikada bir tetiklenen tek bir tick, zamanı gelmiş zamanlamaları sırayla çalıştırır.
 * Bilinçli sadelik (paket eklemedik): cron ifadesi yok, iki biçim var — "her N dakikada"
 * ve "her gün HH:MM".
 *
 * **Kaçan çalıştırmalar telafi edilmez.** Backend kapalıyken geçen zamanlar için sonradan
 * koşu yapılmaz; `nextRunAt` bugünden/şimdiden ileriye alınır. Bunun alternatifi,
 * açılışta birikmiş onlarca koşuyu arka arkaya başlatmak olurdu ki bir test aracında
 * istenmez.
 */
import { prisma } from '../../db.js';
import { runScenario } from './runner.js';
import { acquireRun, releaseRun } from './running.js';

export type ScheduleKind = 'INTERVAL' | 'DAILY';

export interface ScheduleShape {
  kind: ScheduleKind;
  intervalMinutes: number | null;
  dailyAt: string | null;
}

const MINUTE_MS = 60_000;

/** "HH:MM" → [saat, dakika]; biçim bozuksa null. */
export function parseDailyAt(value: string): [number, number] | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/**
 * Bir sonraki çalıştırma zamanı. Sonuç her zaman `from`'dan **sonradır**: aynı ana
 * denk gelen bir zamanlama bir sonraki tura kayar, yoksa tick sonsuz döngüye girer.
 */
export function computeNextRun(schedule: ScheduleShape, from: Date = new Date()): Date {
  if (schedule.kind === 'INTERVAL') {
    const minutes = schedule.intervalMinutes ?? 0;
    if (minutes <= 0) throw new Error('intervalMinutes 0 veya negatif olamaz');
    return new Date(from.getTime() + minutes * MINUTE_MS);
  }

  const parsed = schedule.dailyAt === null ? null : parseDailyAt(schedule.dailyAt);
  if (!parsed) throw new Error('dailyAt "HH:MM" biçiminde olmalı');
  const [hour, minute] = parsed;

  const next = new Date(from);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * Zamanı gelmiş zamanlamaları çalıştırır ve kaçının başlatıldığını döner.
 * Test edilebilir olsun diye tick'ten ayrı durur.
 */
export async function runDueSchedules(now: Date = new Date()): Promise<number> {
  const due = await prisma.scenarioSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: 'asc' },
  });

  let started = 0;
  for (const schedule of due) {
    // Zaman ilerlesin ki bir çalıştırma uzun sürse bile aynı zamanlama tekrar seçilmesin.
    const nextRunAt = computeNextRun(schedule, now);

    if (!acquireRun(schedule.scenarioId)) {
      // Elle başlatılmış bir koşu sürüyor: bu turu atlıyoruz, zamanı yine de ileri alıyoruz.
      await prisma.scenarioSchedule.update({ where: { id: schedule.id }, data: { nextRunAt } });
      continue;
    }

    await prisma.scenarioSchedule.update({
      where: { id: schedule.id },
      data: { nextRunAt, lastRunAt: now },
    });

    try {
      await runScenario(schedule.scenarioId, { trigger: 'SCHEDULED' });
      started += 1;
    } catch (error) {
      // Zamanlayıcı bir koşu yüzünden ölmemeli; hata koşunun kendisinde kayıtlı.
      console.error(
        `[zamanlayıcı] senaryo çalıştırılamadı: ${schedule.scenarioId}`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      releaseRun(schedule.scenarioId);
    }
  }

  return started;
}

let timer: NodeJS.Timeout | null = null;

/** Dakikada bir tick. Çakışan tick olmasın diye bir tur bitmeden yenisi başlamaz. */
export function startScheduler(intervalMs = MINUTE_MS): void {
  if (timer) return;
  let ticking = false;

  timer = setInterval(() => {
    if (ticking) return;
    ticking = true;
    void runDueSchedules()
      .catch((error: unknown) => {
        console.error('[zamanlayıcı] tick hatası', error);
      })
      .finally(() => {
        ticking = false;
      });
  }, intervalMs);

  // Zamanlayıcı süreci ayakta tutmasın.
  timer.unref?.();
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
