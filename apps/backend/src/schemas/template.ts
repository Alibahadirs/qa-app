import { z } from 'zod';

const name = z.string().trim().min(1, 'Ad zorunlu').max(200);
const description = z.string().trim().max(2000);
const text = z.string().max(50_000);

export const createTemplateSchema = z.object({
  name,
  description: description.optional(),
  text,
});

export const updateTemplateSchema = z.object({
  name: name.optional(),
  description: description.optional(),
  text: text.optional(),
});

/** Mevcut bir senaryonun gövdesinden şablon üretir. */
export const templateFromScenarioSchema = z.object({
  scenarioId: z.string().trim().min(1),
  name,
  description: description.optional(),
});

/**
 * Şablondan senaryo kurar. Başlangıç adresi taranır, sonra şablon metni yeni
 * kataloğa göre ayrıştırılır — etiketler tutmazsa senaryo adımsız doğar ve
 * metin, satır bazlı hatalarıyla birlikte kullanıcıya geri verilir.
 */
export const applyTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Senaryo adı zorunlu').max(200),
  baseUrl: z
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
    }, 'Geçerli bir http/https adresi girin'),
  testCaseId: z.string().trim().min(1).nullable().optional(),
});
