/**
 * Backend DTO tipleri. Kaynak: apps/backend/src/routes/*.ts
 * Backend'de bir alan değişirse burası da güncellenmeli.
 */

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik',
};

export interface TestCase {
  id: string;
  title: string;
  description: string | null;
  steps: string[];
  expectedResult: string;
  priority: Priority;
  tags: string[];
  isAutomatable: boolean;
  playwrightScriptPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseInput {
  title: string;
  description?: string;
  steps: string[];
  expectedResult: string;
  priority: Priority;
  tags: string[];
  isAutomatable: boolean;
  playwrightScriptPath?: string;
}

export interface TestSuiteSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  caseCount: number;
}

/** Suite detayında case'ler suite içi sıralarıyla birlikte döner. */
export type TestSuiteCase = TestCase & { order: number };

export interface TestSuiteDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  cases: TestSuiteCase[];
}

export const RESULT_STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED', 'NOT_RUN'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

/** Çalıştırma ekranında kullanıcının işaretleyebileceği durumlar. */
export const MARKABLE_STATUSES = ['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'] as const;

export const RESULT_LABELS: Record<ResultStatus, string> = {
  PASS: 'Geçti',
  FAIL: 'Kaldı',
  BLOCKED: 'Bloke',
  SKIPPED: 'Atlandı',
  NOT_RUN: 'Bekliyor',
};

export type RunStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  IN_PROGRESS: 'Devam ediyor',
  COMPLETED: 'Tamamlandı',
  ABORTED: 'İptal edildi',
};

export type ResultCounts = Record<ResultStatus, number>;

export interface TestRunResult {
  id: string;
  order: number;
  status: ResultStatus;
  notes: string | null;
  screenshotUrl: string | null;
  executionType: 'MANUAL' | 'AUTOMATED';
  durationMs: number | null;
  executedAt: string;
  testCase: TestCase;
}

export interface TestRunSummary {
  id: string;
  name: string;
  suiteId: string;
  suite: { id: string; name: string };
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  counts: ResultCounts;
  total: number;
}

export interface TestRunDetail extends Omit<TestRunSummary, 'counts' | 'total'> {
  counts: ResultCounts;
  total: number;
  results: TestRunResult[];
}

export interface TestCaseFilters {
  q?: string;
  priority?: Priority;
  tag?: string;
  isAutomatable?: boolean;
}

export interface Stats {
  totals: {
    cases: number;
    automatableCases: number;
    manualCases: number;
    suites: number;
    runs: number;
    activeRuns: number;
  };
  passRate: number | null;
  resultTotals: { pass: number; fail: number };
  priority: Record<Priority, number>;
  execution: { MANUAL: number; AUTOMATED: number };
  recentRuns: {
    id: string;
    name: string;
    status: RunStatus;
    startedAt: string;
    suite: { id: string; name: string };
    counts: ResultCounts;
    total: number;
  }[];
  /** Son çalıştırmalarında ilk aday seçicinin tutmadığı senaryolar. */
  selectorDrift: {
    driftingSteps: number;
    scenarios: {
      id: string;
      name: string;
      lastRunAt: string;
      steps: { description: string; usedSelectorIndex: number }[];
    }[];
  };
}

/* ---- Faz 7: kodsuz senaryo otomasyonu ---- */

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
export type StepAction = (typeof STEP_ACTIONS)[number];

export const STEP_ACTION_LABELS: Record<StepAction, string> = {
  GOTO: 'Adrese git',
  CLICK: 'Tıkla',
  TYPE: 'Yaz',
  SELECT: 'Seç',
  WAIT: 'Bekle',
  ASSERT_TEXT: 'Doğrula: metin',
  ASSERT_VISIBLE: 'Doğrula: görünür',
  ASSERT_NOT_VISIBLE: 'Doğrula: gizli',
  ASSERT_URL: 'Doğrula: URL',
  ASSERT_VALUE: 'Doğrula: değer',
};

export interface ScenarioStep {
  id: string;
  scenarioId: string;
  order: number;
  action: StepAction;
  targetElementId: string | null;
  value: string | null;
  timeoutMs: number | null;
}

/** Adım editöründen gönderilen (henüz kaydedilmemiş) adım. */
export interface ScenarioStepInput {
  action: StepAction;
  targetElementId: string | null;
  value: string | null;
  timeoutMs: number | null;
}

export interface ScenarioElement {
  id: string;
  label: string;
  role: string;
  tagName: string;
  pageUrl: string;
}

export interface ScenarioVariable {
  name: string;
  /** `secret` ise sunucu değeri göndermez. */
  value: string | null;
  secret: boolean;
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  testCaseId: string | null;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  elementCount: number;
  /** En az bir doğrulama adımı var mı? Yoksa senaryo yalnızca "çökmedi"yi ölçer. */
  hasAssertion: boolean;
}

export interface ScenarioDetail {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  testCaseId: string | null;
  createdAt: string;
  updatedAt: string;
  steps: ScenarioStep[];
  elements: ScenarioElement[];
  variables: ScenarioVariable[];
  /** Adımlardan üretilen metin görünümü. */
  text: string;
  usedVariables: string[];
  warnings: string[];
}

export interface StepResult {
  id: string;
  order: number;
  action: StepAction;
  description: string;
  status: ResultStatus;
  durationMs: number;
  usedSelectorIndex: number | null;
  /** İlk aday tutmadı: sayfanın değiştiğinin erken habercisi. */
  selectorDrift: boolean;
  screenshotUrl: string | null;
  error: string | null;
}

export interface ScenarioRunSummary {
  id: string;
  scenarioId: string;
  testResultId: string | null;
  status: ResultStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  stepCount: number;
  failedCount: number;
  selectorDrifts: number;
  trigger: RunTrigger;
}

export interface ScenarioRunDetail {
  id: string;
  scenarioId: string;
  status: ResultStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  steps: StepResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    selectorDrifts: number;
  };
}

export interface DiscoveredElement {
  id: string;
  pageUrl: string;
  label: string;
  role: string;
  tagName: string;
  candidatePreviews: string[];
  discoveredAt: string;
}

export interface DiscoveryResponse {
  pageUrl: string;
  count: number;
  elements: DiscoveredElement[];
}

/* ---- Faz 8A: senaryo şablonları ---- */

export interface ScenarioTemplate {
  id: string;
  name: string;
  description: string | null;
  /** Metin dilindeki senaryo gövdesi. */
  text: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  usedVariables: string[];
}

/** Şablonun bir adrese uygulanma sonucu. */
export interface TemplateApplyResult {
  scenarioId: string;
  elementCount: number;
  /** false ise etiketler tutmadı: senaryo adımsız doğdu, metin editöre düşer. */
  applied: boolean;
  text: string;
  errors: { line: number; message: string }[];
  warnings: string[];
  usedVariables: string[];
}

/* ---- Faz 8B: zamanlanmış çalıştırma ---- */

export type ScheduleKind = 'INTERVAL' | 'DAILY';

export interface ScenarioSchedule {
  id: string;
  scenarioId: string;
  enabled: boolean;
  kind: ScheduleKind;
  /** INTERVAL için: kaç dakikada bir. */
  intervalMinutes: number | null;
  /** DAILY için: "HH:MM" (sunucunun yerel saati). */
  dailyAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string;
}

export interface ScheduleInput {
  enabled: boolean;
  kind: ScheduleKind;
  intervalMinutes: number | null;
  dailyAt: string | null;
}

/** Çalıştırmayı elle mi başlattık, zamanlayıcı mı? */
export type RunTrigger = 'MANUAL' | 'SCHEDULED';
