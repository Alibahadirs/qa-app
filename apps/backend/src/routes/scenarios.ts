import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler, notFound } from '../lib/errors.js';
import {
  assertionWarnings,
  collectVariables,
  generateScenarioText,
  parseScenarioText,
  type ElementRef,
  type ParsedStep,
} from '../lib/scenario/text.js';
import { runScenario } from '../lib/scenario/runner.js';
import { acquireRun, releaseRun } from '../lib/scenario/running.js';
import { computeNextRun } from '../lib/scenario/scheduler.js';
import {
  createScenarioSchema,
  replaceStepsSchema,
  replaceVariablesSchema,
  runScenarioSchema,
  scheduleSchema,
  updateScenarioSchema,
} from '../schemas/scenario.js';

export const scenariosRouter = Router();

/**
 * Senaryonun element kataloğu yalnızca kendisine bağlanmış PageElement'lerdir
 * (`POST /discovery` çağrısına `scenarioId` verilerek bağlanır). Başka senaryoların
 * katalogları karışmaz, böylece etiketler senaryo içinde tekil kalır.
 */
async function loadElements(scenarioId: string): Promise<ElementRef[]> {
  const rows = await prisma.pageElement.findMany({
    where: { scenarioId },
    select: { id: true, label: true },
    orderBy: { discoveredAt: 'asc' },
  });
  return rows;
}

async function loadScenario(id: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: 'asc' } },
      elements: { orderBy: { discoveredAt: 'asc' } },
      variables: { orderBy: { name: 'asc' } },
    },
  });
  if (!scenario) throw notFound('Senaryo', id);
  return scenario;
}

function toDto(scenario: Awaited<ReturnType<typeof loadScenario>>) {
  const elements: ElementRef[] = scenario.elements.map((e) => ({ id: e.id, label: e.label }));
  const steps: ParsedStep[] = scenario.steps.map((s) => ({
    action: s.action,
    targetElementId: s.targetElementId,
    value: s.value,
    timeoutMs: s.timeoutMs,
  }));

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    baseUrl: scenario.baseUrl,
    testCaseId: scenario.testCaseId,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
    steps: scenario.steps,
    elements: scenario.elements.map((e) => ({
      id: e.id,
      label: e.label,
      role: e.role,
      tagName: e.tagName,
      pageUrl: e.pageUrl,
    })),
    // Parola gibi değerler yanıtta açığa çıkmaz.
    variables: scenario.variables.map((v) => ({
      name: v.name,
      value: v.secret ? null : v.value,
      secret: v.secret,
    })),
    /** Metin görünümü adımlardan üretilir; iki görünüm arasında tek kaynak adımlardır. */
    text: generateScenarioText(steps, elements),
    usedVariables: collectVariables(steps),
    warnings: assertionWarnings(steps),
  };
}

/** Adımların hedefleri senaryonun kataloğunda mı? Değilse 400. */
function assertTargetsInCatalog(steps: ParsedStep[], elements: ElementRef[]): void {
  const ids = new Set(elements.map((e) => e.id));
  const missing = steps
    .map((s) => s.targetElementId)
    .filter((id): id is string => Boolean(id) && !ids.has(id!));
  if (missing.length > 0) {
    throw new HttpError(400, 'Bazı adımların hedefi bu senaryonun kataloğunda değil', { missing });
  }
}

scenariosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.scenario.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { steps: true, elements: true } },
        // Doğrulaması olmayan senaryo yalnızca "çökmedi"yi ölçer (ilke 3); listede rozetle
        // gösterebilmek için adımların yalnızca tipini çekiyoruz.
        steps: { select: { action: true } },
        // Faz 8D: listede "bu senaryo en son ne yaptı, ne zaman koşacak" görünsün.
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { status: true, startedAt: true, browser: true, trigger: true },
        },
        schedule: true,
      },
    });

    res.json(
      rows.map(({ _count, steps, runs, schedule, ...rest }) => ({
        ...rest,
        stepCount: _count.steps,
        elementCount: _count.elements,
        hasAssertion: assertionWarnings(steps).length === 0,
        lastRun: runs[0] ?? null,
        schedule,
      })),
    );
  }),
);

scenariosRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createScenarioSchema.parse(req.body);

    if (input.testCaseId) {
      const exists = await prisma.testCase.findUnique({
        where: { id: input.testCaseId },
        select: { id: true },
      });
      if (!exists) throw new HttpError(400, `Test case bulunamadı: ${input.testCaseId}`);
    }

    const created = await prisma.scenario.create({ data: input });
    res.status(201).json(toDto(await loadScenario(created.id)));
  }),
);

scenariosRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(toDto(await loadScenario(req.params.id as string)));
  }),
);

/** Metin görünümü — düz metin olarak indirilebilir/kopyalanabilir. */
scenariosRouter.get(
  '/:id/text',
  asyncHandler(async (req, res) => {
    const scenario = await loadScenario(req.params.id as string);
    res.type('text/plain; charset=utf-8').send(toDto(scenario).text);
  }),
);

scenariosRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = updateScenarioSchema.parse(req.body);
    await prisma.scenario.update({ where: { id: req.params.id as string }, data: input });
    res.json(toDto(await loadScenario(req.params.id as string)));
  }),
);

scenariosRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.scenario.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  }),
);

/**
 * Adımları topluca değiştirir. Gövde `steps` (form editörü) veya `text` (metin
 * görünümü) içerebilir — ikisi de aynı adım listesine indirgenir.
 */
scenariosRouter.put(
  '/:id/steps',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);
    const elements = await loadElements(scenarioId);
    const input = replaceStepsSchema.parse(req.body);

    let steps: ParsedStep[];
    if ('text' in input) {
      const parsed = parseScenarioText(input.text, elements);
      if (parsed.errors.length > 0) {
        throw new HttpError(400, 'Senaryo metni ayrıştırılamadı', { errors: parsed.errors });
      }
      steps = parsed.steps;
    } else {
      steps = input.steps;
      assertTargetsInCatalog(steps, elements);
    }

    await prisma.$transaction([
      prisma.scenarioStep.deleteMany({ where: { scenarioId } }),
      prisma.scenarioStep.createMany({
        data: steps.map((step, index) => ({ ...step, scenarioId, order: index })),
      }),
      prisma.scenario.update({ where: { id: scenarioId }, data: { updatedAt: new Date() } }),
    ]);

    res.json(toDto(await loadScenario(scenarioId)));
  }),
);

/** ScenarioRun'ı adım sonuçlarıyla birlikte rapora çevirir. */
async function loadScenarioRun(runId: string) {
  const run = await prisma.scenarioRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!run) throw notFound('Senaryo çalıştırması', runId);

  const steps = run.steps.map((s) => ({
    ...s,
    // İlke 2: ilk aday tutmadıysa adım geçse bile bu bir erken uyarıdır.
    selectorDrift: s.usedSelectorIndex !== null && s.usedSelectorIndex > 0,
    screenshotUrl: s.screenshotPath ? `/uploads/${s.screenshotPath}` : null,
  }));

  return {
    ...run,
    steps,
    summary: {
      total: steps.length,
      passed: steps.filter((s) => s.status === 'PASS').length,
      failed: steps.filter((s) => s.status === 'FAIL').length,
      skipped: steps.filter((s) => s.status === 'SKIPPED').length,
      selectorDrifts: steps.filter((s) => s.selectorDrift).length,
    },
  };
}

/** Senaryoyu çalıştırır ve adım adım raporu döner. */
scenariosRouter.post(
  '/:id/run',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);

    // Gövde boş gelebilir (eski istemciler): varsayılan Chromium.
    const { browser } = runScenarioSchema.parse(req.body ?? {});

    if (!acquireRun(scenarioId)) {
      throw new HttpError(409, 'Bu senaryo için bir çalıştırma zaten sürüyor.');
    }
    try {
      const runId = await runScenario(scenarioId, { browser });
      res.status(201).json(await loadScenarioRun(runId));
    } finally {
      releaseRun(scenarioId);
    }
  }),
);

/* ---- Faz 8B: zamanlama ---- */

/** Senaryo başına en fazla bir zamanlama; yoksa null döner. */
scenariosRouter.get(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);
    res.json(await prisma.scenarioSchedule.findUnique({ where: { scenarioId } }));
  }),
);

/**
 * Zamanlamayı kurar veya değiştirir. `nextRunAt` her zaman **sunucuda** hesaplanır;
 * istemcinin saatine güvenmeyiz.
 */
scenariosRouter.put(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    const scenario = await loadScenario(scenarioId);
    if (scenario.steps.length === 0) {
      throw new HttpError(400, 'Adımı olmayan senaryo zamanlanamaz.');
    }

    const input = scheduleSchema.parse(req.body);
    const nextRunAt = computeNextRun(input);
    const data = { ...input, nextRunAt };

    res.json(
      await prisma.scenarioSchedule.upsert({
        where: { scenarioId },
        create: { ...data, scenarioId },
        update: data,
      }),
    );
  }),
);

scenariosRouter.delete(
  '/:id/schedule',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    if (!(await prisma.scenarioSchedule.findUnique({ where: { scenarioId } }))) {
      throw notFound('Zamanlama', scenarioId);
    }
    await prisma.scenarioSchedule.delete({ where: { scenarioId } });
    res.status(204).end();
  }),
);

/** Senaryonun çalıştırma geçmişi (yeniden eskiye). */
scenariosRouter.get(
  '/:id/runs',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);

    const runs = await prisma.scenarioRun.findMany({
      where: { scenarioId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { steps: { select: { status: true, usedSelectorIndex: true } } },
    });

    res.json(
      runs.map(({ steps, ...run }) => ({
        ...run,
        stepCount: steps.length,
        failedCount: steps.filter((s) => s.status === 'FAIL').length,
        selectorDrifts: steps.filter((s) => (s.usedSelectorIndex ?? 0) > 0).length,
      })),
    );
  }),
);

scenariosRouter.get(
  '/:id/runs/:runId',
  asyncHandler(async (req, res) => {
    res.json(await loadScenarioRun(req.params.runId as string));
  }),
);

/** Değişken deposunu topluca değiştirir (`{{degisken}}` değerleri). */
scenariosRouter.put(
  '/:id/variables',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);
    const { variables } = replaceVariablesSchema.parse(req.body);

    // Değeri gönderilmeyen değişkenin saklı değeri korunur (gizli değerler istemciye
    // hiç gitmediği için arayüz onları geri yollayamaz).
    const stored = new Map(
      (await prisma.scenarioVariable.findMany({ where: { scenarioId } })).map((v) => [
        v.name,
        v.value,
      ]),
    );
    const missingValue = variables.find((v) => v.value === undefined && !stored.has(v.name));
    if (missingValue) {
      throw new HttpError(400, `Yeni değişkenin değeri zorunlu: ${missingValue.name}`);
    }

    await prisma.$transaction([
      prisma.scenarioVariable.deleteMany({ where: { scenarioId } }),
      prisma.scenarioVariable.createMany({
        data: variables.map((v) => ({
          scenarioId,
          name: v.name,
          secret: v.secret,
          value: v.value ?? stored.get(v.name)!,
        })),
      }),
    ]);

    res.json(toDto(await loadScenario(scenarioId)));
  }),
);
