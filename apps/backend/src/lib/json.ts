/**
 * SQLite dizi tipini desteklemediği için string[] alanları (steps, tags) JSON string
 * olarak saklanır. Postgres'e geçildiğinde sadece bu dosya kaldırılır ve alanlar
 * native `String[]` olur — dönüşüm başka hiçbir yere sızmaz.
 */

export const serializeStringArray = (value: string[]): string => JSON.stringify(value);

export function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
