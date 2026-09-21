import { prisma } from '../../db.js';
import type { DiscoveredElement } from './types.js';

/** URL'i kataloğa yazarken tek biçime indirger (hash parçası anlamsız). */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.toString();
}

/**
 * Keşfedilen elementleri kataloğa yazar ve kayıtları döner.
 *
 * Aynı element yeniden keşfedildiğinde **güncellenir, yeniden oluşturulmaz**:
 * senaryo adımlarının işaret ettiği `PageElement.id` sabit kalmalıdır (7A).
 * Senaryoya bağlı olmayan katalog (scenarioId = null) için SQLite'ta NULL'lar
 * benzersizlik kısıtında birbirinden farklı sayıldığından eşleştirmeyi elle yaparız.
 */
export async function saveDiscoveredElements(
  pageUrl: string,
  scenarioId: string | null,
  elements: DiscoveredElement[],
) {
  const existing = await prisma.pageElement.findMany({ where: { pageUrl, scenarioId } });
  const byKey = new Map(existing.map((row) => [row.key, row]));

  return prisma.$transaction(
    elements.map((el) => {
      const data = {
        label: el.label,
        role: el.role,
        tagName: el.tagName,
        candidateSelectors: JSON.stringify(el.candidateSelectors),
      };
      const match = byKey.get(el.key);
      return match
        ? prisma.pageElement.update({ where: { id: match.id }, data })
        : prisma.pageElement.create({ data: { ...data, pageUrl, scenarioId, key: el.key } });
    }),
  );
}
