import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler } from '../lib/errors.js';

export const statsRouter = Router();

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const RESULT_KEYS = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const;

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
