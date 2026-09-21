/**
 * Faz 7C — adım çalıştırıcı.
 *
 * Senaryoyu Playwright ile adım adım yürütür. İki tasarım ilkesi burada yaşar:
 *
 *  - **Kademeli seçici düşme (ilke 2):** her hedef için aday seçiciler sırayla denenir.
 *    Hangi adayın tuttuğu `usedSelectorIndex` olarak kaydedilir; ilk aday dışında bir şey
 *    tuttuysa adım geçer ama "seçici kayması" uyarısı taşır — sayfanın değiştiğinin
 *    erken habercisi budur.
 *  - **Sürekli keşif (ilke 4):** adım sonrası URL değiştiyse yeni sayfa da kataloglanır.
 *
 * Hata anında tam sayfa ekran görüntüsü alınır, kalan adımlar SKIPPED işaretlenir.
 */
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { prisma } from '../../db.js';
import { saveDiscoveredElements, normalizeUrl } from '../discovery/catalog.js';
import { discoverOnPage } from '../discovery/discover.js';
import { buildLocator, describeCandidate } from '../discovery/selectors.js';
import type { SelectorCandidate } from '../discovery/types.js';
import { UPLOAD_DIR } from '../uploads.js';
import { generateScenarioText, type ParsedStep, type StepAction } from './text.js';

/** Adımın kendi `timeoutMs` değeri yoksa kullanılan süre. */
const DEFAULT_STEP_TIMEOUT_MS = 10_000;
/** İlk adaya daha cömert davranırız; sonraki adaylar hızlıca elenir. */
const FIRST_CANDIDATE_TIMEOUT_MS = 5_000;
const OTHER_CANDIDATE_TIMEOUT_MS = 2_000;
/** Tüm senaryo için üst sınır; aşılırsa kalan adımlar BLOCKED olur. */
const MAX_RUN_MS = 180_000;

type StepStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'BLOCKED';

interface ResolvedTarget {
  locator: Locator;
  index: number;
  tried: string[];
}

class StepError extends Error {}

/** `{{ad}}` yer tutucularını değişken deposundan doldurur. */
function substitute(value: string | null, variables: Map<string, string>): string | null {
  if (value === null) return null;
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, name: string) => {
    const resolved = variables.get(name);
    if (resolved === undefined) throw new StepError(`Değişken tanımlı değil: {{${name}}}`);
    return resolved;
  });
}

/**
 * Aday seçicileri sırayla dener; tek eşleşme veren ilk adayı döner.
 * Çalışma anında birden fazla eşleşme veren aday atlanır — yanlış elementi
 * tıklamaktansa sıradaki adaya geçmek doğrudur.
 */
async function resolveTarget(
  page: Page,
  candidates: SelectorCandidate[],
  timeoutMs: number,
): Promise<ResolvedTarget> {
  const tried: string[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const shown = describeCandidate(candidate);
    tried.push(shown);
    const budget = index === 0 ? FIRST_CANDIDATE_TIMEOUT_MS : OTHER_CANDIDATE_TIMEOUT_MS;

    try {
      const locator = buildLocator(page, candidate);
      await locator.first().waitFor({ state: 'attached', timeout: Math.min(budget, timeoutMs) });
      if ((await locator.count()) !== 1) continue;
      return { locator, index, tried };
    } catch {
      // Bu aday tutmadı; sıradakine geç (kademeli düşme).
    }
  }

  throw new StepError(`Hiçbir aday seçici elementi bulamadı. Denenenler: ${tried.join(' → ')}`);
}

interface StepContext {
  page: Page;
  step: ParsedStep;
  timeoutMs: number;
  candidates: SelectorCandidate[];
  variables: Map<string, string>;
}

/** Tek bir adımı yürütür ve tutan aday seçicinin sırasını döner. */
async function executeStep(ctx: StepContext): Promise<number | null> {
  const { page, step, timeoutMs, candidates, variables } = ctx;
  const value = substitute(step.value, variables);

  const target = async (): Promise<ResolvedTarget> => {
    if (candidates.length === 0) {
      throw new StepError('Adımın hedef elementi katalogda yok (silinmiş olabilir).');
    }
    return resolveTarget(page, candidates, timeoutMs);
  };

  switch (step.action) {
    case 'GOTO': {
      if (!value) throw new StepError('GOTO adımında URL yok.');
      await page.goto(value, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      return null;
    }

    case 'CLICK': {
      const t = await target();
      await t.locator.click({ timeout: timeoutMs });
      return t.index;
    }

    case 'TYPE': {
      const t = await target();
      await t.locator.fill(value ?? '', { timeout: timeoutMs });
      return t.index;
    }

    case 'SELECT': {
      const t = await target();
      await t.locator.selectOption(value ?? '', { timeout: timeoutMs });
      return t.index;
    }

    case 'WAIT': {
      if (step.targetElementId) {
        const t = await target();
        await t.locator.waitFor({ state: 'visible', timeout: timeoutMs });
        return t.index;
      }
      if (value) {
        await page.waitForURL((url) => url.href.includes(value), { timeout: timeoutMs });
        return null;
      }
      await page.waitForTimeout(step.timeoutMs ?? 0);
      return null;
    }

    case 'ASSERT_TEXT': {
      if (!value) throw new StepError('Doğrulanacak metin boş.');
      try {
        await page.getByText(value).first().waitFor({ state: 'visible', timeout: timeoutMs });
      } catch {
        throw new StepError(`Sayfada "${value}" metni görünür değil.`);
      }
      return null;
    }

    case 'ASSERT_VISIBLE': {
      const t = await target();
      try {
        await t.locator.waitFor({ state: 'visible', timeout: timeoutMs });
      } catch {
        throw new StepError('Element bulundu ama görünür değil.');
      }
      return t.index;
    }

    case 'ASSERT_NOT_VISIBLE': {
      // Element hiç bulunamıyorsa da koşul sağlanmıştır.
      try {
        const t = await resolveTarget(page, candidates, timeoutMs);
        await t.locator.waitFor({ state: 'hidden', timeout: timeoutMs });
        return t.index;
      } catch (err) {
        if (err instanceof StepError) return null;
        throw new StepError('Element hâlâ görünür.');
      }
    }

    case 'ASSERT_URL': {
      if (!value) throw new StepError('Doğrulanacak URL parçası boş.');
      try {
        await page.waitForURL((url) => url.href.includes(value), { timeout: timeoutMs });
      } catch {
        throw new StepError(`URL "${value}" içermiyor. Güncel URL: ${page.url()}`);
      }
      return null;
    }

    case 'ASSERT_VALUE': {
      const t = await target();
      const actual = await t.locator.inputValue({ timeout: timeoutMs });
      if (actual !== (value ?? '')) {
        throw new StepError(`Beklenen değer "${value ?? ''}", bulunan "${actual}".`);
      }
      return t.index;
    }
  }
}

/** Hata anında tam sayfa görüntüsü; dosya adı manuel yüklemelerle aynı dizinde durur. */
async function captureScreenshot(page: Page, runId: string, order: number): Promise<string | null> {
  const filename = `scenario-${runId}-${order}-${randomBytes(4).toString('hex')}.png`;
  try {
    await page.screenshot({ path: join(UPLOAD_DIR, filename), fullPage: true, timeout: 10_000 });
    return filename;
  } catch {
    return null;
  }
}

export interface RunScenarioOptions {
  /** Senaryo bir test run'ı içinden çalıştırıldıysa yazılacak TestResult. */
  testResultId?: string | null;
}

/** Senaryoyu çalıştırır ve oluşturulan ScenarioRun'ın id'sini döner. */
export async function runScenario(
  scenarioId: string,
  options: RunScenarioOptions = {},
): Promise<string> {
  const scenario = await prisma.scenario.findUniqueOrThrow({
    where: { id: scenarioId },
    include: {
      steps: { orderBy: { order: 'asc' }, include: { target: true } },
      elements: { select: { id: true, label: true } },
      variables: true,
    },
  });

  const run = await prisma.scenarioRun.create({
    data: { scenarioId, testResultId: options.testResultId ?? null, status: 'NOT_RUN' },
  });

  const variables = new Map(scenario.variables.map((v) => [v.name, v.value]));
  const elementRefs = scenario.elements;
  const startedAt = Date.now();

  if (scenario.steps.length === 0) {
    await prisma.scenarioRun.update({
      where: { id: run.id },
      data: {
        status: 'BLOCKED',
        completedAt: new Date(),
        durationMs: 0,
        error: 'Senaryoda hiç adım yok.',
      },
    });
    return run.id;
  }

  const browser = await chromium.launch();
  let runStatus: StepStatus = 'PASS';
  let runError: string | null = null;

  try {
    const page = await browser.newPage();
    // İlk adım zaten bir GOTO değilse senaryo başlangıç URL'inden başlar.
    if (scenario.steps[0]?.action !== 'GOTO') {
      await page.goto(scenario.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    }

    const catalogued = new Set<string>();
    let stopped = false;

    for (const step of scenario.steps) {
      const parsed: ParsedStep = {
        action: step.action as StepAction,
        targetElementId: step.targetElementId,
        value: step.value,
        timeoutMs: step.timeoutMs,
      };
      const description = generateScenarioText([parsed], elementRefs);

      if (stopped) {
        await prisma.stepResult.create({
          data: {
            scenarioRunId: run.id,
            stepId: step.id,
            order: step.order,
            action: step.action,
            description,
            status: 'SKIPPED',
            durationMs: 0,
          },
        });
        continue;
      }

      if (Date.now() - startedAt > MAX_RUN_MS) {
        stopped = true;
        runStatus = 'BLOCKED';
        runError = `Senaryo ${MAX_RUN_MS / 1000} saniyelik üst sınırı aştı.`;
        await prisma.stepResult.create({
          data: {
            scenarioRunId: run.id,
            stepId: step.id,
            order: step.order,
            action: step.action,
            description,
            status: 'BLOCKED',
            durationMs: 0,
            error: runError,
          },
        });
        continue;
      }

      const urlBefore = page.url();
      const stepStarted = Date.now();
      let status: StepStatus = 'PASS';
      let usedSelectorIndex: number | null = null;
      let screenshotPath: string | null = null;
      let error: string | null = null;

      try {
        const candidates: SelectorCandidate[] = step.target
          ? (JSON.parse(step.target.candidateSelectors) as SelectorCandidate[])
          : [];
        usedSelectorIndex = await executeStep({
          page,
          step: parsed,
          timeoutMs: step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
          candidates,
          variables,
        });
      } catch (err) {
        status = 'FAIL';
        error = (err as Error).message.slice(0, 2000);
        screenshotPath = await captureScreenshot(page, run.id, step.order);
        stopped = true;
        runStatus = 'FAIL';
      }

      await prisma.stepResult.create({
        data: {
          scenarioRunId: run.id,
          stepId: step.id,
          order: step.order,
          action: step.action,
          description,
          status,
          durationMs: Date.now() - stepStarted,
          usedSelectorIndex,
          screenshotPath,
          error,
        },
      });

      // İlke 4: yeni bir sayfaya geçildiyse o sayfa da kataloglanır.
      if (status === 'PASS' && page.url() !== urlBefore) {
        const pageUrl = normalizeUrl(page.url());
        if (!catalogued.has(pageUrl)) {
          catalogued.add(pageUrl);
          try {
            await saveDiscoveredElements(pageUrl, scenarioId, await discoverOnPage(page));
          } catch {
            // Katalog güncellemesi senaryo sonucunu etkilemez.
          }
        }
      }
    }
  } catch (err) {
    runStatus = 'BLOCKED';
    runError = `Çalıştırma başlatılamadı: ${(err as Error).message}`.slice(0, 2000);
  } finally {
    await browser.close();
  }

  const durationMs = Date.now() - startedAt;
  await prisma.scenarioRun.update({
    where: { id: run.id },
    data: { status: runStatus, completedAt: new Date(), durationMs, error: runError },
  });

  // Test run'ı içinden çalıştırıldıysa sonucu TestResult'a da yaz.
  if (options.testResultId) {
    await prisma.testResult.update({
      where: { id: options.testResultId },
      data: {
        status: runStatus === 'PASS' ? 'PASS' : runStatus === 'FAIL' ? 'FAIL' : 'BLOCKED',
        executionType: 'AUTOMATED',
        durationMs,
        notes: runError ?? (runStatus === 'PASS' ? null : 'Senaryo adımlarından biri başarısız.'),
        executedAt: new Date(),
      },
    });
  }

  return run.id;
}
