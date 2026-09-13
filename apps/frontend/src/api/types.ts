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

export interface TestCaseFilters {
  q?: string;
  priority?: Priority;
  tag?: string;
  isAutomatable?: boolean;
}
