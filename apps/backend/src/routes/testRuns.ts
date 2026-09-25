import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { type Request, type Response, Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler, notFound } from '../lib/errors.js';
import { csvFilename, toCsv } from '../lib/csv.js';
import { parseStringArray } from '../lib/json.js';
import { resolveScriptPath, runPlaywrightSpec } from '../lib/playwright.js';
import { runScenario } from '../lib/scenario/runner.js';
import {
  UPLOAD_DIR,
  UPLOAD_ROUTE,
  hasImageSignature,
  screenshotUpload,
  toUploadError,
} from '../lib/uploads.js';
import {
  createTestRunSchema,
  updateResultSchema,
  updateTestRunSchema,
} from '../schemas/testRun.js';

export const testRunsRouter = Router();

const RESULT_KEYS = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const;
type Counts = Record<(typeof RESULT_KEYS)[number], number>;

const emptyCounts = (): Counts => ({ PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, NOT_RUN: 0 });

async function loadRun(id: string) {
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      suite: { select: { id: true, name: true } },
      results: {
        orderBy: { order: 'asc' },
        include: { testCase: true },
      },
    },
  });
  if (!run) throw notFound('Test run', id);

  const counts = emptyCounts();
  for (const r of run.results) counts[r.status] += 1;

  const { results, ...rest } = run;
  return {
    ...rest,
    counts,
    total: results.length,
    results: results.map((r) => ({
      id: r.id,
      order: r.order,
      status: r.status,
      notes: r.notes,
      screenshotUrl: r.screenshotPath ? `${UPLOAD_ROUTE}/${r.screenshotPath}` : null,
      executionType: r.executionType,
      durationMs: r.durationMs,
      executedAt: r.executedAt,
      testCase: {
        ...r.testCase,
        steps: parseStringArray(r.testCase.steps),
        tags: parseStringArray(r.testCase.tags),
      },
    })),
  };
}

/** Tamamlanmış/iptal edilmiş run'a yazma denemelerini engeller. */
async function assertRunEditable(id: string) {
  const run = await prisma.testRun.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!run) throw notFound('Test run', id);
  if (run.status !== 'IN_PROGRESS') {
    throw new HttpError(409, `Run "${run.status}" durumunda; sonuçları değiştirilemez.`);
  }
  return run;
}

testRunsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const runs = await prisma.testRun.findMany({
      orderBy: { startedAt: 'desc' },
      include: {
        suite: { select: { id: true, name: true } },
        results: { select: { status: true } },
      },
    });

    res.json(
      runs.map(({ results, ...run }) => {
        const counts = emptyCounts();
        for (const r of results) counts[r.status] += 1;
        return { ...run, counts, total: results.length };
      }),
    );
  }),
);

testRunsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { suiteId, name } = createTestRunSchema.parse(req.body);

    const suite = await prisma.testSuite.findUnique({
      where: { id: suiteId },
      include: { cases: { orderBy: { order: 'asc' }, select: { caseId: true } } },
    });
    if (!suite) throw notFound('Test suite', suiteId);
    if (suite.cases.length === 0) {
      throw new HttpError(400, 'Boş bir suite ile test run başlatılamaz.');
    }

    const created = await prisma.testRun.create({
      data: {
        suiteId,
        name: name ?? `${suite.name} — ${new Date().toLocaleDateString('tr-TR')}`,
        results: {
          // Suite sırası run'a kopyalanır; suite sonradan değişse de bu run etkilenmez.
          create: suite.cases.map((c, index) => ({
            caseId: c.caseId,
            order: index,
            status: 'NOT_RUN' as const,
            executionType: 'MANUAL' as const,
          })),
        },
      },
      select: { id: true },
    });

    res.status(201).json(await loadRun(created.id));
  }),
);

testRunsRouter.get(
  '/:id/export.csv',
  asyncHandler(async (req, res) => {
    const run = await loadRun(req.params.id as string);
    const csv = toCsv(
      ['#', 'Test Case', 'Öncelik', 'Sonuç', 'Tür', 'Süre (sn)', 'Not', 'Ekran Görüntüsü', 'Zaman'],
      run.results.map((r, i) => [
        i + 1,
        r.testCase.title,
        r.testCase.priority,
        r.status,
        r.executionType,
        r.durationMs === null ? '' : (r.durationMs / 1000).toFixed(1),
        r.notes,
        r.screenshotUrl,
        r.executedAt.toISOString(),
      ]),
    );
    res.type('text/csv; charset=utf-8')
      .setHeader('content-disposition', `attachment; filename="${csvFilename(run.name)}"`);
    res.send(csv);
  }),
);

testRunsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await loadRun(req.params.id as string));
  }),
);

testRunsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { status } = updateTestRunSchema.parse(req.body);
    await assertRunEditable(id);

    await prisma.testRun.update({
      where: { id },
      data: { status, completedAt: new Date() },
    });

    res.json(await loadRun(id));
  }),
);

testRunsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const results = await prisma.testRun.findUnique({
      where: { id },
      select: { results: { select: { screenshotPath: true } } },
    });
    if (!results) throw notFound('Test run', id);

    // Run silinince artık kimsenin referans vermediği dosyalar da gitsin.
    for (const r of results.results) {
      if (r.screenshotPath) await unlink(join(UPLOAD_DIR, r.screenshotPath)).catch(() => {});
    }

    await prisma.testRun.delete({ where: { id } });
    res.status(204).end();
  }),
);

testRunsRouter.patch(
  '/:id/results/:caseId',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const caseId = req.params.caseId as string;
    const input = updateResultSchema.parse(req.body);
    await assertRunEditable(id);

    const existing = await prisma.testResult.findUnique({
      where: { runId_caseId: { runId: id, caseId } },
      select: { id: true },
    });
    if (!existing) throw new HttpError(404, `Run ${id} içinde case bulunamadı: ${caseId}`);

    await prisma.testResult.update({
      where: { runId_caseId: { runId: id, caseId } },
      data: {
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.notes === undefined ? {} : { notes: input.notes || null }),
        executedAt: new Date(),
      },
    });

    res.json(await loadRun(id));
  }),
);

/** Aynı sonucu iki kez paralel tetiklemeyi engelleyen basit kilit. */
const running = new Set<string>();

testRunsRouter.post(
  '/:id/results/:caseId/run-automated',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const caseId = req.params.caseId as string;
    await assertRunEditable(id);

    const result = await prisma.testResult.findUnique({
      where: { runId_caseId: { runId: id, caseId } },
      select: { testCase: { select: { isAutomatable: true, playwrightScriptPath: true } } },
    });
    if (!result) throw new HttpError(404, `Run ${id} içinde case bulunamadı: ${caseId}`);

    const { isAutomatable, playwrightScriptPath } = result.testCase;
    if (!isAutomatable) {
      throw new HttpError(400, 'Bu test case otomatize edilebilir olarak işaretlenmemiş.');
    }
    if (!playwrightScriptPath) {
      throw new HttpError(400, 'Bu test case için Playwright script yolu tanımlı değil.');
    }

    const scriptPath = resolveScriptPath(playwrightScriptPath);

    const key = `${id}:${caseId}`;
    if (running.has(key)) throw new HttpError(409, 'Bu case için bir çalıştırma zaten sürüyor.');
    running.add(key);

    try {
      const outcome = await runPlaywrightSpec(scriptPath);
      await prisma.testResult.update({
        where: { runId_caseId: { runId: id, caseId } },
        data: {
          status: outcome.status,
          durationMs: outcome.durationMs,
          executionType: 'AUTOMATED',
          notes: outcome.notes,
          executedAt: new Date(),
        },
      });
    } finally {
      running.delete(key);
    }

    res.json(await loadRun(id));
  }),
);

/**
 * Faz 7C — case'e bağlı kodsuz senaryoyu çalıştırır ve sonucu bu TestResult'a yazar.
 * `.spec.ts` yolu ile çalışan `run-automated` yerini korur; bu ikinci otomasyon yöntemidir.
 */
testRunsRouter.post(
  '/:id/results/:caseId/run-scenario',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const caseId = req.params.caseId as string;
    await assertRunEditable(id);

    const result = await prisma.testResult.findUnique({
      where: { runId_caseId: { runId: id, caseId } },
      select: { id: true },
    });
    if (!result) throw new HttpError(404, `Run ${id} içinde case bulunamadı: ${caseId}`);

    const requested = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId : null;
    const scenarios = await prisma.scenario.findMany({
      where: { testCaseId: caseId },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (scenarios.length === 0) {
      throw new HttpError(400, 'Bu test case\'e bağlı bir senaryo yok.');
    }
    const scenarioId = requested ?? scenarios[0]!.id;
    if (!scenarios.some((s) => s.id === scenarioId)) {
      throw new HttpError(400, 'Senaryo bu test case\'e bağlı değil.', {
        available: scenarios,
      });
    }

    const key = `${id}:${caseId}`;
    if (running.has(key)) throw new HttpError(409, 'Bu case için bir çalıştırma zaten sürüyor.');
    running.add(key);
    try {
      await runScenario(scenarioId, { testResultId: result.id });
    } finally {
      running.delete(key);
    }

    res.json(await loadRun(id));
  }),
);

testRunsRouter.post('/:id/results/:caseId/screenshot', (req: Request, res: Response, next) => {
  screenshotUpload(req, res, (err: unknown) => {
    if (err) {
      next(toUploadError(err));
      return;
    }
    void handleScreenshotUpload(req, res).catch(next);
  });
});

async function handleScreenshotUpload(req: Request, res: Response) {
  const id = req.params.id as string;
  const caseId = req.params.caseId as string;
  const file = req.file;

  const cleanup = async () => {
    if (file) await unlink(file.path).catch(() => {});
  };

  if (!file) throw new HttpError(400, 'Dosya gönderilmedi (alan adı: screenshot).');

  if (!(await hasImageSignature(file.path))) {
    await cleanup();
    throw new HttpError(400, 'Dosya içeriği PNG, JPEG veya WebP değil.');
  }

  const run = await prisma.testRun.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!run) {
    await cleanup();
    throw notFound('Test run', id);
  }
  if (run.status !== 'IN_PROGRESS') {
    await cleanup();
    throw new HttpError(409, `Run "${run.status}" durumunda; ekran görüntüsü eklenemez.`);
  }

  const existing = await prisma.testResult.findUnique({
    where: { runId_caseId: { runId: id, caseId } },
    select: { screenshotPath: true },
  });
  if (!existing) {
    await cleanup();
    throw new HttpError(404, `Run ${id} içinde case bulunamadı: ${caseId}`);
  }

  // Aynı case'e ikinci kez yüklenirse eski dosya diskte kalmasın.
  if (existing.screenshotPath) {
    await unlink(join(UPLOAD_DIR, existing.screenshotPath)).catch(() => {});
  }

  await prisma.testResult.update({
    where: { runId_caseId: { runId: id, caseId } },
    data: { screenshotPath: file.filename },
  });

  res.status(201).json(await loadRun(id));
}

testRunsRouter.delete(
  '/:id/results/:caseId/screenshot',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const caseId = req.params.caseId as string;
    await assertRunEditable(id);

    const existing = await prisma.testResult.findUnique({
      where: { runId_caseId: { runId: id, caseId } },
      select: { screenshotPath: true },
    });
    if (!existing) throw new HttpError(404, `Run ${id} içinde case bulunamadı: ${caseId}`);
    if (!existing.screenshotPath) throw new HttpError(404, 'Bu sonuçta ekran görüntüsü yok.');

    await unlink(join(UPLOAD_DIR, existing.screenshotPath)).catch(() => {});
    await prisma.testResult.update({
      where: { runId_caseId: { runId: id, caseId } },
      data: { screenshotPath: null },
    });

    res.json(await loadRun(id));
  }),
);
