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
import {
  createScenarioSchema,
  replaceStepsSchema,
  replaceVariablesSchema,
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
      include: { _count: { select: { steps: true, elements: true } } },
    });

    res.json(
      rows.map(({ _count, ...rest }) => ({
        ...rest,
        stepCount: _count.steps,
        elementCount: _count.elements,
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

/** Değişken deposunu topluca değiştirir (`{{degisken}}` değerleri). */
scenariosRouter.put(
  '/:id/variables',
  asyncHandler(async (req, res) => {
    const scenarioId = req.params.id as string;
    await loadScenario(scenarioId);
    const { variables } = replaceVariablesSchema.parse(req.body);

    await prisma.$transaction([
      prisma.scenarioVariable.deleteMany({ where: { scenarioId } }),
      prisma.scenarioVariable.createMany({
        data: variables.map((v) => ({ ...v, scenarioId })),
      }),
    ]);

    res.json(toDto(await loadScenario(scenarioId)));
  }),
);
