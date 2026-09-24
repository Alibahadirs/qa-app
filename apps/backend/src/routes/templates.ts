import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler, notFound } from '../lib/errors.js';
import { saveDiscoveredElements, normalizeUrl } from '../lib/discovery/catalog.js';
import { discoverPage } from '../lib/discovery/discover.js';
import {
  assertionWarnings,
  collectVariables,
  generateScenarioText,
  parseScenarioText,
  type ElementRef,
  type ParsedStep,
} from '../lib/scenario/text.js';
import {
  applyTemplateSchema,
  createTemplateSchema,
  templateFromScenarioSchema,
  updateTemplateSchema,
} from '../schemas/template.js';

export const templatesRouter = Router();

/** Ad benzersiz; çakışmayı 409 olarak bildiririz (Prisma'nın P2002'si yerine). */
async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const existing = await prisma.scenarioTemplate.findUnique({ where: { name } });
  if (existing && existing.id !== exceptId) {
    throw new HttpError(409, `Bu adla bir şablon zaten var: ${name}`);
  }
}

function toDto(template: {
  id: string;
  name: string;
  description: string | null;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  // Şablon metninden okunabilen iki şey: kaç adım ve hangi değişkenler gerekiyor.
  // Etiketler burada çözülemez (katalog yok), bu yüzden satır sayısı üzerinden gideriz.
  const lines = template.text.split('\n').filter((line) => line.trim() !== '');
  return {
    ...template,
    stepCount: lines.length,
    usedVariables: [...new Set(template.text.match(/\{\{\s*([\w.-]+)\s*\}\}/g) ?? [])].map((m) =>
      m.replace(/[{}\s]/g, ''),
    ),
  };
}

templatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.scenarioTemplate.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(rows.map(toDto));
  }),
);

templatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await prisma.scenarioTemplate.findUnique({ where: { id: req.params.id as string } });
    if (!row) throw notFound('Şablon', req.params.id as string);
    res.json(toDto(row));
  }),
);

templatesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createTemplateSchema.parse(req.body);
    await assertNameFree(input.name);
    res.status(201).json(toDto(await prisma.scenarioTemplate.create({ data: input })));
  }),
);

/**
 * Mevcut senaryoyu şablona çevirir. Senaryonun adımları element id'lerine bağlıdır;
 * şablona giderken metne dönüştürülür, böylece başka kataloglarda da anlam taşır.
 */
templatesRouter.post(
  '/from-scenario',
  asyncHandler(async (req, res) => {
    const input = templateFromScenarioSchema.parse(req.body);
    const scenario = await prisma.scenario.findUnique({
      where: { id: input.scenarioId },
      include: { steps: { orderBy: { order: 'asc' } }, elements: true },
    });
    if (!scenario) throw new HttpError(400, `Senaryo bulunamadı: ${input.scenarioId}`);
    if (scenario.steps.length === 0) {
      throw new HttpError(400, 'Adımı olmayan senaryodan şablon çıkarılamaz.');
    }
    await assertNameFree(input.name);

    const elements: ElementRef[] = scenario.elements.map((e) => ({ id: e.id, label: e.label }));
    const steps: ParsedStep[] = scenario.steps.map((s) => ({
      action: s.action,
      targetElementId: s.targetElementId,
      value: s.value,
      timeoutMs: s.timeoutMs,
    }));

    const created = await prisma.scenarioTemplate.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        text: generateScenarioText(steps, elements),
      },
    });
    res.status(201).json(toDto(created));
  }),
);

templatesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const input = updateTemplateSchema.parse(req.body);
    const existing = await prisma.scenarioTemplate.findUnique({ where: { id } });
    if (!existing) throw notFound('Şablon', id);
    if (input.name) await assertNameFree(input.name, id);
    res.json(toDto(await prisma.scenarioTemplate.update({ where: { id }, data: input })));
  }),
);

templatesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    if (!(await prisma.scenarioTemplate.findUnique({ where: { id } }))) {
      throw notFound('Şablon', id);
    }
    await prisma.scenarioTemplate.delete({ where: { id } });
    res.status(204).end();
  }),
);

/**
 * Şablondan senaryo kurar: senaryo yaratılır, başlangıç adresi taranır, sonra şablon
 * metni **yeni kataloğa göre** ayrıştırılır.
 *
 * Şablon metni element etiketlerine dayanır. Etiketler tutmazsa senaryo adımsız kalır;
 * bu bir hata değil, beklenen durumdur — yanıt `text` ve satır bazlı `errors` taşır,
 * arayüz metni editöre düşürüp kullanıcıya düzelttirir.
 */
templatesRouter.post(
  '/:id/apply',
  asyncHandler(async (req, res) => {
    const templateId = req.params.id as string;
    const template = await prisma.scenarioTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw notFound('Şablon', templateId);

    const input = applyTemplateSchema.parse(req.body);
    if (input.testCaseId) {
      const exists = await prisma.testCase.findUnique({
        where: { id: input.testCaseId },
        select: { id: true },
      });
      if (!exists) throw new HttpError(400, `Test case bulunamadı: ${input.testCaseId}`);
    }

    const scenario = await prisma.scenario.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl,
        description: template.description,
        testCaseId: input.testCaseId ?? null,
      },
    });

    // Katalog olmadan hiçbir etiket çözülemez; önce başlangıç adresini tarıyoruz.
    const pageUrl = normalizeUrl(input.baseUrl);
    const discovered = await discoverPage(pageUrl);
    const saved = await saveDiscoveredElements(pageUrl, scenario.id, discovered);
    const elements: ElementRef[] = saved.map((e) => ({ id: e.id, label: e.label }));

    const parsed = parseScenarioText(template.text, elements);
    if (parsed.errors.length === 0) {
      await prisma.scenarioStep.createMany({
        data: parsed.steps.map((step, index) => ({
          scenarioId: scenario.id,
          order: index,
          action: step.action,
          targetElementId: step.targetElementId,
          value: step.value,
          timeoutMs: step.timeoutMs,
        })),
      });
    }

    res.status(201).json({
      scenarioId: scenario.id,
      elementCount: saved.length,
      applied: parsed.errors.length === 0,
      /** Uygulanamadıysa arayüz bu metni editöre düşürür. */
      text: template.text,
      errors: parsed.errors,
      warnings: parsed.errors.length === 0 ? assertionWarnings(parsed.steps) : [],
      usedVariables: parsed.errors.length === 0 ? collectVariables(parsed.steps) : [],
    });
  }),
);
