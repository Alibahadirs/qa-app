import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler, notFound } from '../lib/errors.js';
import { csvFilename, toCsv } from '../lib/csv.js';
import { parseStringArray, serializeStringArray } from '../lib/json.js';
import {
  createTestCaseSchema,
  listTestCasesQuerySchema,
  updateTestCaseSchema,
} from '../schemas/testCase.js';
import type { TestCaseModel } from '../generated/prisma/models.js';

export const testCasesRouter = Router();

/** DB satırını API temsiline çevirir (steps/tags JSON string → string[]). */
function toDto(row: TestCaseModel) {
  return {
    ...row,
    steps: parseStringArray(row.steps),
    tags: parseStringArray(row.tags),
  };
}

testCasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { priority, tag, isAutomatable, q } = listTestCasesQuerySchema.parse(req.query);

    const rows = await prisma.testCase.findMany({
      where: {
        ...(priority ? { priority } : {}),
        ...(isAutomatable === undefined ? {} : { isAutomatable }),
      },
      orderBy: { createdAt: 'desc' },
    });

    // SQLite LIKE yalnız ASCII'de büyük/küçük harf duyarsız ("çıkış" ≠ "Çıkış"),
    // bu yüzden arama da tags gibi uygulama katmanında, Türkçe yerel ayarla yapılır.
    const needle = q?.toLocaleLowerCase('tr');
    const filtered = rows.filter(
      (r) =>
        (!tag || parseStringArray(r.tags).includes(tag)) &&
        (!needle || r.title.toLocaleLowerCase('tr').includes(needle)),
    );

    res.json(filtered.map(toDto));
  }),
);

testCasesRouter.get(
  '/export.csv',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.testCase.findMany({ orderBy: { createdAt: 'desc' } });
    const csv = toCsv(
      ['Başlık', 'Açıklama', 'Adımlar', 'Beklenen Sonuç', 'Öncelik', 'Etiketler', 'Otomatize', 'Script', 'Oluşturma'],
      rows.map((c) => [
        c.title,
        c.description,
        parseStringArray(c.steps).map((s, i) => `${i + 1}. ${s}`).join('\n'),
        c.expectedResult,
        c.priority,
        parseStringArray(c.tags).join(', '),
        c.isAutomatable ? 'Evet' : 'Hayır',
        c.playwrightScriptPath,
        c.createdAt.toISOString(),
      ]),
    );
    res.type('text/csv; charset=utf-8')
      .setHeader('content-disposition', `attachment; filename="${csvFilename('test-cases')}"`);
    res.send(csv);
  }),
);

testCasesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createTestCaseSchema.parse(req.body);

    const created = await prisma.testCase.create({
      data: {
        ...input,
        steps: serializeStringArray(input.steps),
        tags: serializeStringArray(input.tags),
      },
    });

    res.status(201).json(toDto(created));
  }),
);

testCasesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const row = await prisma.testCase.findUnique({ where: { id } });
    if (!row) throw notFound('Test case', id);
    res.json(toDto(row));
  }),
);

testCasesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { steps, tags, ...rest } = updateTestCaseSchema.parse(req.body);

    const exists = await prisma.testCase.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Test case', id);

    const updated = await prisma.testCase.update({
      where: { id },
      data: {
        ...rest,
        ...(steps === undefined ? {} : { steps: serializeStringArray(steps) }),
        ...(tags === undefined ? {} : { tags: serializeStringArray(tags) }),
      },
    });

    res.json(toDto(updated));
  }),
);

testCasesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const row = await prisma.testCase.findUnique({
      where: { id },
      select: { _count: { select: { results: true } } },
    });
    if (!row) throw notFound('Test case', id);

    // Şemadaki cascade bu case'in sonuçlarını geçmiş run'lardan da silerdi;
    // tamamlanmış raporlar sessizce değişmesin.
    if (row._count.results > 0) {
      throw new HttpError(
        409,
        `Bu test case ${row._count.results} run sonucunda geçiyor; silinirse o run'ların ` +
          'geçmişi değişir. Suite\'ten çıkarabilir ya da önce ilgili run\'ları silebilirsiniz.',
      );
    }

    await prisma.testCase.delete({ where: { id } });
    res.status(204).end();
  }),
);
