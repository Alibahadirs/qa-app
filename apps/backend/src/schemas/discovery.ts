import { z } from 'zod';

/** Yalnızca http/https; dosya sistemi ve diğer şemalar reddedilir. */
const httpUrl = z
  .string()
  .trim()
  .min(1, 'URL zorunlu')
  .max(2000)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Geçerli bir http/https adresi girin');

export const discoverSchema = z.object({
  url: httpUrl,
  /** 7B'de Scenario gelince kataloğu senaryoya bağlamak için. */
  scenarioId: z.string().trim().min(1).optional(),
});

export const discoveryQuerySchema = z.object({ url: httpUrl });

export type DiscoverInput = z.infer<typeof discoverSchema>;
