import { z } from 'zod';

export const RESULT_STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const;
export const RUN_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'ABORTED'] as const;

export const createTestRunSchema = z.object({
  suiteId: z.string().trim().min(1, 'Suite seçilmeli'),
  name: z.string().trim().min(1).max(200).optional(),
});

/** Run'ın kendi durumu yalnızca bitiş durumlarına çekilebilir. */
export const updateTestRunSchema = z.object({
  status: z.enum(['COMPLETED', 'ABORTED']),
});

export const updateResultSchema = z
  .object({
    status: z.enum(RESULT_STATUSES).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, {
    message: 'status veya notes alanlarından en az biri gönderilmeli',
  });

export type CreateTestRunInput = z.infer<typeof createTestRunSchema>;
export type UpdateResultInput = z.infer<typeof updateResultSchema>;
