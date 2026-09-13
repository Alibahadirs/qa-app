import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, notFound } from '../lib/errors.js';
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
        ...(q ? { title: { contains: q } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    // tags JSON string olarak saklandığı için filtre uygulama katmanında yapılır.
    const filtered = tag ? rows.filter((r) => parseStringArray(r.tags).includes(tag)) : rows;

    res.json(filtered.map(toDto));
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
    const exists = await prisma.testCase.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Test case', id);

    await prisma.testCase.delete({ where: { id } });
    res.status(204).end();
  }),
);
