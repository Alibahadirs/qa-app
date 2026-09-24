import { z } from 'zod';

export const STEP_ACTIONS = [
  'GOTO',
  'CLICK',
  'TYPE',
  'SELECT',
  'WAIT',
  'ASSERT_TEXT',
  'ASSERT_VISIBLE',
  'ASSERT_NOT_VISIBLE',
  'ASSERT_URL',
  'ASSERT_VALUE',
] as const;

const name = z.string().trim().min(1, 'Ad zorunlu').max(200);
const description = z.string().trim().max(2000);
const baseUrl = z
  .string()
  .trim()
  .min(1, 'Başlangıç URL zorunlu')
  .max(2000)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Geçerli bir http/https adresi girin');

export const createScenarioSchema = z.object({
  name,
  description: description.optional(),
  baseUrl,
  testCaseId: z.string().trim().min(1).optional(),
});

export const updateScenarioSchema = z.object({
  name: name.optional(),
  description: description.optional(),
  baseUrl: baseUrl.optional(),
  /** null gönderilirse case bağlantısı kaldırılır. */
  testCaseId: z.string().trim().min(1).nullable().optional(),
});

const stepSchema = z.object({
  action: z.enum(STEP_ACTIONS),
  targetElementId: z.string().trim().min(1).nullable().default(null),
  value: z.string().max(2000).nullable().default(null),
  timeoutMs: z.number().int().min(0).max(600_000).nullable().default(null),
});

/**
 * Adımlar ya form editöründen (`steps`) ya da metin görünümünden (`text`) gelir;
 * ikisi de aynı uç noktaya yazar, böylece çift yönlü yazım tek kaynaktan yürür.
 */
export const replaceStepsSchema = z.union([
  z.object({ steps: z.array(stepSchema) }),
  z.object({ text: z.string().max(50_000) }),
]);

export const replaceVariablesSchema = z.object({
  variables: z.array(
    z.object({
      name: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .regex(/^[\w.-]+$/, 'Değişken adı harf, rakam, nokta, tire ve alt çizgi içerebilir'),
      /**
       * Atlanırsa aynı adla saklanan değer korunur. Gizli değerler istemciye hiç
       * gönderilmediği için, arayüz onları geri yollamadan da kaydedebilsin diye.
       */
      value: z.string().max(2000).optional(),
      secret: z.boolean().default(false),
    }),
  ),
});

export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;
export type UpdateScenarioInput = z.infer<typeof updateScenarioSchema>;
