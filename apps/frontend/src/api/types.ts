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
}
