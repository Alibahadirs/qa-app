import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler, notFound } from '../lib/errors.js';
import { parseStringArray } from '../lib/json.js';
import {
  addCasesSchema,
  createTestSuiteSchema,
  reorderCasesSchema,
  updateTestSuiteSchema,
} from '../schemas/testSuite.js';

export const testSuitesRouter = Router();

/** Verilen id'lerin tamamı TestCase tablosunda var mı? Yoksa 400 döner. */
async function assertCasesExist(caseIds: string[]): Promise<void> {
  if (caseIds.length === 0) return;
  const found = await prisma.testCase.findMany({
    where: { id: { in: caseIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((c) => c.id));
  const missing = caseIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new HttpError(400, 'Bazı test case id\'leri bulunamadı', { missing });
  }
}

async function loadSuiteWithCases(id: string) {
  const suite = await prisma.testSuite.findUnique({
    where: { id },
    include: {
      cases: {
        orderBy: { order: 'asc' },
        include: { testCase: true },
      },
    },
  });
  if (!suite) throw notFound('Test suite', id);

  const { cases, ...rest } = suite;
  return {
    ...rest,
    cases: cases.map((link) => ({
      order: link.order,
      ...link.testCase,
      steps: parseStringArray(link.testCase.steps),
      tags: parseStringArray(link.testCase.tags),
    })),
  };
}

testSuitesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const suites = await prisma.testSuite.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cases: true } } },
    });

    res.json(
      suites.map(({ _count, ...suite }) => ({ ...suite, caseCount: _count.cases })),
    );
  }),
);

testSuitesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { caseIds, ...data } = createTestSuiteSchema.parse(req.body);
    await assertCasesExist(caseIds);

    const created = await prisma.testSuite.create({
      data: {
        ...data,
        cases: {
          create: caseIds.map((caseId, index) => ({ caseId, order: index })),
        },
      },
    });

    res.status(201).json(await loadSuiteWithCases(created.id));
  }),
);

testSuitesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await loadSuiteWithCases(req.params.id as string));
  }),
);

testSuitesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = updateTestSuiteSchema.parse(req.body);

    const exists = await prisma.testSuite.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Test suite', id);

    await prisma.testSuite.update({ where: { id }, data });
    res.json(await loadSuiteWithCases(id));
  }),
);

testSuitesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const suite = await prisma.testSuite.findUnique({
      where: { id },
      select: { _count: { select: { runs: true } } },
    });
    if (!suite) throw notFound('Test suite', id);

    // Şemadaki cascade run geçmişini de silerdi; geçmiş sessizce kaybolmasın.
    if (suite._count.runs > 0) {
      throw new HttpError(
        409,
        `Bu suite'e bağlı ${suite._count.runs} run var; silinirse run geçmişi de kaybolur. ` +
          "Önce Run'lar sayfasından bu run'ları silin.",
      );
    }

    await prisma.testSuite.delete({ where: { id } });
    res.status(204).end();
  }),
);

testSuitesRouter.post(
  '/:id/cases',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { caseIds } = addCasesSchema.parse(req.body);

    const suite = await prisma.testSuite.findUnique({ where: { id }, select: { id: true } });
    if (!suite) throw notFound('Test suite', id);
    await assertCasesExist(caseIds);

    const last = await prisma.testSuiteCase.findFirst({
      where: { suiteId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    let nextOrder = (last?.order ?? -1) + 1;

    // Zaten bağlı olanları atla (idempotent davranış).
    const existing = await prisma.testSuiteCase.findMany({
      where: { suiteId: id, caseId: { in: caseIds } },
      select: { caseId: true },
    });
    const existingIds = new Set(existing.map((e) => e.caseId));
    const toAdd = caseIds.filter((caseId) => !existingIds.has(caseId));

    if (toAdd.length > 0) {
      await prisma.testSuiteCase.createMany({
        data: toAdd.map((caseId) => ({ suiteId: id, caseId, order: nextOrder++ })),
      });
    }

    res.status(200).json(await loadSuiteWithCases(id));
  }),
);

testSuitesRouter.delete(
  '/:id/cases/:caseId',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const caseId = req.params.caseId as string;

    const link = await prisma.testSuiteCase.findUnique({
      where: { suiteId_caseId: { suiteId: id, caseId } },
    });
    if (!link) throw new HttpError(404, `Suite ${id} içinde case bulunamadı: ${caseId}`);

    await prisma.testSuiteCase.delete({
      where: { suiteId_caseId: { suiteId: id, caseId } },
    });

    res.status(200).json(await loadSuiteWithCases(id));
  }),
);

testSuitesRouter.put(
  '/:id/cases/order',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { caseIds } = reorderCasesSchema.parse(req.body);

    const links = await prisma.testSuiteCase.findMany({
      where: { suiteId: id },
      select: { caseId: true },
    });
    if (links.length === 0) throw notFound('Test suite', id);

    const currentIds = new Set(links.map((l) => l.caseId));
    const unknown = caseIds.filter((c) => !currentIds.has(c));
    // Yinelenen id uzunluk kontrolünü atlatıp iki case'e aynı sırayı verirdi.
    const duplicated = new Set(caseIds).size !== caseIds.length;
    if (unknown.length > 0 || duplicated || caseIds.length !== links.length) {
      throw new HttpError(400, 'Sıralama listesi suite içeriğiyle birebir eşleşmeli', {
        expected: [...currentIds],
        received: caseIds,
      });
    }

    await prisma.$transaction(
      caseIds.map((caseId, index) =>
        prisma.testSuiteCase.update({
          where: { suiteId_caseId: { suiteId: id, caseId } },
          data: { order: index },
        }),
      ),
    );

    res.json(await loadSuiteWithCases(id));
  }),
);
