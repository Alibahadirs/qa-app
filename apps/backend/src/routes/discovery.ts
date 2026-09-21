import { Router } from 'express';
import { prisma } from '../db.js';
import { HttpError, asyncHandler } from '../lib/errors.js';
import { saveDiscoveredElements, normalizeUrl } from '../lib/discovery/catalog.js';
import { discoverPage } from '../lib/discovery/discover.js';
import { describeCandidate } from '../lib/discovery/selectors.js';
import type { SelectorCandidate } from '../lib/discovery/types.js';
import { discoverSchema, discoveryQuerySchema } from '../schemas/discovery.js';

export const discoveryRouter = Router();

function toResponse(row: {
  id: string;
  pageUrl: string;
  label: string;
  role: string;
  tagName: string;
  candidateSelectors: string;
  discoveredAt: Date;
}) {
  const candidates = JSON.parse(row.candidateSelectors) as SelectorCandidate[];
  return {
    id: row.id,
    pageUrl: row.pageUrl,
    label: row.label,
    role: row.role,
    tagName: row.tagName,
    candidateSelectors: candidates,
    // Arayüzde okunabilir gösterim; seçicinin kendisi yapısal olarak saklanır.
    candidatePreviews: candidates.map(describeCandidate),
    discoveredAt: row.discoveredAt,
  };
}

/** Bir sayfayı tarar, doğrulanmış seçicilerle elementleri kataloğa yazar. */
discoveryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { url, scenarioId } = discoverSchema.parse(req.body);
    const pageUrl = normalizeUrl(url);

    if (scenarioId) {
      const scenario = await prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: { id: true },
      });
      if (!scenario) throw new HttpError(400, `Senaryo bulunamadı: ${scenarioId}`);
    }

    const elements = await discoverPage(pageUrl);

    const saved = await saveDiscoveredElements(pageUrl, scenarioId ?? null, elements);

    res.status(201).json({ pageUrl, count: saved.length, elements: saved.map(toResponse) });
  }),
);

/** Daha önce kataloglanmış elementleri döner (tarama yapmaz). */
discoveryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { url } = discoveryQuerySchema.parse(req.query);
    const pageUrl = normalizeUrl(url);

    const rows = await prisma.pageElement.findMany({
      where: { pageUrl },
      orderBy: { discoveredAt: 'asc' },
    });

    res.json({ pageUrl, count: rows.length, elements: rows.map(toResponse) });
  }),
);
