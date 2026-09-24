import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/errors.js';

export const statsRouter = Router();

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const RESULT_KEYS = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const;

/**
 * Faz 8D — senaryo sağlığı.
 *
 * Zamanlanmış koşular arka planda çalıştığı için kimse bakmadan da düşebilirler.
 * Burası "gece ne oldu, bu gece ne koşacak" sorusunun tek cevap yeri: son koşusu
 * başarısız olan senaryolar ve sıradaki zamanlamalar.
 */
async function scenarioHealthReport(now: Date) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [scenarios, scheduleRows, ranLast24h] = await Promise.all([
    prisma.scenario.findMany({
      select: {
        id: true,
        name: true,
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            status: true,
            startedAt: true,
            browser: true,
            trigger: true,
            error: true,
            steps: {
              where: { status: { in: ['FAIL', 'BLOCKED'] } },
              orderBy: { order: 'asc' },
              take: 1,
              select: { description: true, error: true },
            },
          },
        },
      },
    }),
    prisma.scenarioSchedule.findMany({
      where: { enabled: true },
      orderBy: { nextRunAt: 'asc' },
      include: { scenario: { select: { id: true, name: true } } },
    }),
    prisma.scenarioRun.count({ where: { startedAt: { gte: dayAgo } } }),
  ]);

  // "Başarısız" = son koşu FAIL ya da BLOCKED. Hiç koşmamış senaryo başarısız sayılmaz;
  // ayrı bir durumdur ve sayıda görünür.
  const failing = scenarios
    .map(({ id, name, runs }) => {
      const last = runs[0];
      if (!last || (last.status !== 'FAIL' && last.status !== 'BLOCKED')) return null;
      const step = last.steps[0];
      return {
        id,
        name,
        status: last.status,
        lastRunAt: last.startedAt,
        browser: last.browser,
        trigger: last.trigger,
        // Nerede düştüğü: adım varsa adım, yoksa koşu düzeyindeki hata.
        failedStep: step?.description ?? null,
        error: step?.error ?? last.error,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.lastRunAt.getTime() - a.lastRunAt.getTime());

  return {
    totals: {
      scenarios: scenarios.length,
      scheduled: scheduleRows.length,
      neverRun: scenarios.filter((s) => s.runs.length === 0).length,
      ranLast24h,
    },
    failing,
    upcoming: scheduleRows.map((s) => ({
      scenarioId: s.scenario.id,
      scenarioName: s.scenario.name,
      kind: s.kind,
      intervalMinutes: s.intervalMinutes,
      dailyAt: s.dailyAt,
      browser: s.browser,
      nextRunAt: s.nextRunAt,
      lastRunAt: s.lastRunAt,
    })),
  };
}

/**
 * Seçici kayması toplu raporu: her senaryonun **son** çalıştırmasına bakılır ve ilk aday
 * dışında bir adayla bulunan adımlar toplanır. Kayma, sayfanın değiştiğinin erken
 * habercisidir; tek bir rapora gömülü kalmasın diye dashboard'a taşınır.
 */
async function selectorDriftReport() {
  const scenarios = await prisma.scenario.findMany({
    select: {
      id: true,
      name: true,
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: {
          startedAt: true,
          steps: { select: { description: true, usedSelectorIndex: true }, orderBy: { order: 'asc' } },
        },
      },
    },
  });

  const drifting = scenarios
    .map(({ id, name, runs }) => {
      const lastRun = runs[0];
      if (!lastRun) return null;
      const steps = lastRun.steps
        .filter((s) => s.usedSelectorIndex !== null && s.usedSelectorIndex > 0)
        .map((s) => ({ description: s.description, usedSelectorIndex: s.usedSelectorIndex! }));
      if (steps.length === 0) return null;
      return { id, name, lastRunAt: lastRun.startedAt, steps };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.lastRunAt.getTime() - a.lastRunAt.getTime());

  return {
    scenarios: drifting,
    driftingSteps: drifting.reduce((sum, s) => sum + s.steps.length, 0),
  };
}

statsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [
      totalCases,
      automatableCases,
      totalSuites,
      totalRuns,
      activeRuns,
      byPriority,
      byExecution,
      recentRaw,
    ] = await Promise.all([
      prisma.testCase.count(),
      prisma.testCase.count({ where: { isAutomatable: true } }),
      prisma.testSuite.count(),
      prisma.testRun.count(),
      prisma.testRun.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.testCase.groupBy({ by: ['priority'], _count: true }),
      // Manuel vs otomatik dağılımı: yalnızca gerçekten çalıştırılmış sonuçlar.
      prisma.testResult.groupBy({
        by: ['executionType'],
        _count: true,
        where: { status: { not: 'NOT_RUN' } },
      }),
      prisma.testRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
        include: {
          suite: { select: { id: true, name: true } },
          results: { select: { status: true } },
        },
      }),
    ]);

    const priority = Object.fromEntries(PRIORITIES.map((p) => [p, 0])) as Record<string, number>;
    for (const row of byPriority) priority[row.priority] = row._count;

    const execution = { MANUAL: 0, AUTOMATED: 0 };
    for (const row of byExecution) execution[row.executionType] = row._count;

    const recentRuns = recentRaw.map(({ results, ...run }) => {
      const counts = Object.fromEntries(RESULT_KEYS.map((k) => [k, 0])) as Record<string, number>;
      for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return { ...run, counts, total: results.length };
    });

    // Başarı oranı: tüm run'lardaki PASS / (PASS + FAIL). Bloke ve atlananlar
    // bir kalite sinyali taşımadığı için paydaya dahil edilmez.
    const [passCount, failCount] = await Promise.all([
      prisma.testResult.count({ where: { status: 'PASS' } }),
      prisma.testResult.count({ where: { status: 'FAIL' } }),
    ]);
    const decided = passCount + failCount;

    res.json({
      selectorDrift: await selectorDriftReport(),
      scenarioHealth: await scenarioHealthReport(new Date()),
      totals: {
        cases: totalCases,
        automatableCases,
        manualCases: totalCases - automatableCases,
        suites: totalSuites,
        runs: totalRuns,
        activeRuns,
      },
      passRate: decided === 0 ? null : Math.round((passCount / decided) * 1000) / 10,
      resultTotals: { pass: passCount, fail: failCount },
      priority,
      execution,
      recentRuns,
    });
  }),
);
