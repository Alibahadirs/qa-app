import { z } from 'zod';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

const title = z.string().trim().min(1, 'Başlık zorunlu').max(200);
const description = z.string().trim().max(2000);
const steps = z.array(z.string().trim().min(1));
const expectedResult = z.string().trim().min(1, 'Beklenen sonuç zorunlu').max(2000);
const priority = z.enum(PRIORITIES);
const tags = z.array(z.string().trim().min(1));
const isAutomatable = z.boolean();
const playwrightScriptPath = z.string().trim().max(500);

export const createTestCaseSchema = z.object({
  title,
  description: description.optional(),
  steps: steps.default([]),
  expectedResult,
  priority: priority.default('MEDIUM'),
  tags: tags.default([]),
  isAutomatable: isAutomatable.default(false),
  playwrightScriptPath: playwrightScriptPath.optional(),
});

/**
 * PATCH şeması default İÇERMEZ. `createTestCaseSchema.partial()` kullanılırsa
 * gönderilmeyen steps/tags alanları default değerleriyle ([]) dolar ve mevcut
 * veriyi sıfırlar — bu yüzden alanlar burada ayrıca tanımlanmıştır.
 */
export const updateTestCaseSchema = z.object({
  title: title.optional(),
  description: description.optional(),
  steps: steps.optional(),
  expectedResult: expectedResult.optional(),
  priority: priority.optional(),
  tags: tags.optional(),
  isAutomatable: isAutomatable.optional(),
  playwrightScriptPath: playwrightScriptPath.optional(),
});

const booleanParam = z
  .union([z.literal('true'), z.literal('false')])
  .transform((v) => v === 'true');

export const listTestCasesQuerySchema = z.object({
  priority: priority.optional(),
  tag: z.string().trim().min(1).optional(),
  isAutomatable: booleanParam.optional(),
  q: z.string().trim().min(1).optional(),
});

export type CreateTestCaseInput = z.infer<typeof createTestCaseSchema>;
export type UpdateTestCaseInput = z.infer<typeof updateTestCaseSchema>;
export type ListTestCasesQuery = z.infer<typeof listTestCasesQuerySchema>;
