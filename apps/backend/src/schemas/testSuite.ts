import { z } from 'zod';

export const createTestSuiteSchema = z.object({
  name: z.string().trim().min(1, 'Ad zorunlu').max(200),
  description: z.string().trim().max(2000).optional(),
  caseIds: z.array(z.string().trim().min(1)).default([]),
});

export const updateTestSuiteSchema = createTestSuiteSchema.omit({ caseIds: true }).partial();

export const addCasesSchema = z.object({
  caseIds: z.array(z.string().trim().min(1)).min(1, 'En az bir case id gerekli'),
});

export const reorderCasesSchema = z.object({
  caseIds: z.array(z.string().trim().min(1)).min(1, 'En az bir case id gerekli'),
});

export type CreateTestSuiteInput = z.infer<typeof createTestSuiteSchema>;
export type UpdateTestSuiteInput = z.infer<typeof updateTestSuiteSchema>;
