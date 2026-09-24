import type {
  DiscoveryResponse,
  ResultStatus,
  ScenarioDetail,
  ScenarioRunDetail,
  ScenarioRunSummary,
  ScenarioStepInput,
  ScenarioSummary,
  ScenarioTemplate,
  Stats,
  TemplateApplyResult,
  TestCase,
  TestCaseFilters,
  TestCaseInput,
  TestRunDetail,
  TestRunSummary,
  TestSuiteDetail,
  TestSuiteSummary,
} from './types.js';

const BASE = '/api';

interface ApiErrorBody {
  error?: string;
  details?: { path: string; message: string }[] | unknown;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const isForm = init?.body instanceof FormData;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      // FormData'da boundary'yi tarayıcı belirler; content-type elle set edilmemeli.
      headers: init?.body && !isForm ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamadı. Backend çalışıyor mu?');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = (body ?? {}) as ApiErrorBody;
    const detailText = Array.isArray(err.details)
      ? err.details
          .map((d) => (typeof d === 'object' && d && 'message' in d ? String(d.message) : ''))
          .filter(Boolean)
          .join(', ')
      : '';
    throw new ApiError(
      res.status,
      detailText ? `${err.error ?? 'Hata'}: ${detailText}` : (err.error ?? `HTTP ${res.status}`),
      err.details,
    );
  }

  return body as T;
}

function toQuery(filters: TestCaseFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.isAutomatable !== undefined) {
    params.set('isAutomatable', String(filters.isAutomatable));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Backend `/uploads/<dosya>` döner; dev sunucusunda backend'e yalnızca `/api/*`
 * proxy'lendiği için ön ek eklenir.
 */
export const resolveUploadUrl = (url: string | null): string | null =>
  url ? `${BASE}${url}` : null;

export interface AuthState {
  required: boolean;
  authenticated: boolean;
}

/** Dosya indirme bağlantıları (tarayıcı doğrudan açar). */
export const exportUrl = {
  testCases: () => `${BASE}/test-cases/export.csv`,
  run: (runId: string) => `${BASE}/test-runs/${runId}/export.csv`,
};

export const api = {
  getAuthState: () => request<AuthState>('/auth/me'),

  login: (password: string) =>
    request<AuthState>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),

  logout: () => request<AuthState>('/auth/logout', { method: 'POST' }),

  getStats: () => request<Stats>('/stats'),

  listTestCases: (filters: TestCaseFilters = {}) =>
    request<TestCase[]>(`/test-cases${toQuery(filters)}`),

  getTestCase: (id: string) => request<TestCase>(`/test-cases/${id}`),

  createTestCase: (input: TestCaseInput) =>
    request<TestCase>('/test-cases', { method: 'POST', body: JSON.stringify(input) }),

  updateTestCase: (id: string, input: Partial<TestCaseInput>) =>
    request<TestCase>(`/test-cases/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteTestCase: (id: string) => request<void>(`/test-cases/${id}`, { method: 'DELETE' }),

  listTestSuites: () => request<TestSuiteSummary[]>('/test-suites'),

  getTestSuite: (id: string) => request<TestSuiteDetail>(`/test-suites/${id}`),

  createTestSuite: (input: { name: string; description?: string; caseIds?: string[] }) =>
    request<TestSuiteDetail>('/test-suites', { method: 'POST', body: JSON.stringify(input) }),

  updateTestSuite: (id: string, input: { name?: string; description?: string }) =>
    request<TestSuiteDetail>(`/test-suites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteTestSuite: (id: string) => request<void>(`/test-suites/${id}`, { method: 'DELETE' }),

  addCasesToSuite: (id: string, caseIds: string[]) =>
    request<TestSuiteDetail>(`/test-suites/${id}/cases`, {
      method: 'POST',
      body: JSON.stringify({ caseIds }),
    }),

  removeCaseFromSuite: (id: string, caseId: string) =>
    request<TestSuiteDetail>(`/test-suites/${id}/cases/${caseId}`, { method: 'DELETE' }),

  reorderSuiteCases: (id: string, caseIds: string[]) =>
    request<TestSuiteDetail>(`/test-suites/${id}/cases/order`, {
      method: 'PUT',
      body: JSON.stringify({ caseIds }),
    }),

  listTestRuns: () => request<TestRunSummary[]>('/test-runs'),

  getTestRun: (id: string) => request<TestRunDetail>(`/test-runs/${id}`),

  createTestRun: (input: { suiteId: string; name?: string }) =>
    request<TestRunDetail>('/test-runs', { method: 'POST', body: JSON.stringify(input) }),

  finishTestRun: (id: string, status: 'COMPLETED' | 'ABORTED') =>
    request<TestRunDetail>(`/test-runs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteTestRun: (id: string) => request<void>(`/test-runs/${id}`, { method: 'DELETE' }),

  updateResult: (
    runId: string,
    caseId: string,
    input: { status?: ResultStatus; notes?: string | null },
  ) =>
    request<TestRunDetail>(`/test-runs/${runId}/results/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  uploadScreenshot: (runId: string, caseId: string, file: File) => {
    const form = new FormData();
    form.append('screenshot', file);
    return request<TestRunDetail>(`/test-runs/${runId}/results/${caseId}/screenshot`, {
      method: 'POST',
      body: form,
    });
  },

  runAutomated: (runId: string, caseId: string) =>
    request<TestRunDetail>(`/test-runs/${runId}/results/${caseId}/run-automated`, {
      method: 'POST',
    }),

  deleteScreenshot: (runId: string, caseId: string) =>
    request<TestRunDetail>(`/test-runs/${runId}/results/${caseId}/screenshot`, {
      method: 'DELETE',
    }),

  /* ---- Faz 7: kodsuz senaryo otomasyonu ---- */

  listScenarios: () => request<ScenarioSummary[]>('/scenarios'),

  getScenario: (id: string) => request<ScenarioDetail>(`/scenarios/${id}`),

  createScenario: (input: { name: string; baseUrl: string; description?: string }) =>
    request<ScenarioDetail>('/scenarios', { method: 'POST', body: JSON.stringify(input) }),

  updateScenario: (
    id: string,
    input: { name?: string; baseUrl?: string; description?: string; testCaseId?: string | null },
  ) => request<ScenarioDetail>(`/scenarios/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  deleteScenario: (id: string) => request<void>(`/scenarios/${id}`, { method: 'DELETE' }),

  /** Adım editöründen kaydetme. */
  saveScenarioSteps: (id: string, steps: ScenarioStepInput[]) =>
    request<ScenarioDetail>(`/scenarios/${id}/steps`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    }),

  /** Metin görünümünden kaydetme; hatalı satırlar ApiError.details içinde döner. */
  saveScenarioText: (id: string, text: string) =>
    request<ScenarioDetail>(`/scenarios/${id}/steps`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),

  /** `value` atlanan değişkenin sunucudaki değeri korunur (gizli değerler için). */
  saveScenarioVariables: (
    id: string,
    variables: { name: string; value?: string; secret: boolean }[],
  ) =>
    request<ScenarioDetail>(`/scenarios/${id}/variables`, {
      method: 'PUT',
      body: JSON.stringify({ variables }),
    }),

  /* ---- Faz 8A: şablonlar ---- */

  listTemplates: () => request<ScenarioTemplate[]>('/scenario-templates'),

  createTemplate: (input: { name: string; description?: string; text: string }) =>
    request<ScenarioTemplate>('/scenario-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** Mevcut senaryonun gövdesini şablona çevirir. */
  createTemplateFromScenario: (input: {
    scenarioId: string;
    name: string;
    description?: string;
  }) =>
    request<ScenarioTemplate>('/scenario-templates/from-scenario', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTemplate: (id: string, input: { name?: string; description?: string; text?: string }) =>
    request<ScenarioTemplate>(`/scenario-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteTemplate: (id: string) =>
    request<void>(`/scenario-templates/${id}`, { method: 'DELETE' }),

  /** Şablondan senaryo kurar; adres taranır ve metin yeni kataloğa göre çözülür. */
  applyTemplate: (
    id: string,
    input: { name: string; baseUrl: string; testCaseId?: string | null },
  ) =>
    request<TemplateApplyResult>(`/scenario-templates/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  runScenario: (id: string) =>
    request<ScenarioRunDetail>(`/scenarios/${id}/run`, { method: 'POST' }),

  listScenarioRuns: (id: string) => request<ScenarioRunSummary[]>(`/scenarios/${id}/runs`),

  getScenarioRun: (id: string, runId: string) =>
    request<ScenarioRunDetail>(`/scenarios/${id}/runs/${runId}`),

  /** Bir sayfayı tarayıp elementlerini senaryonun kataloğuna yazar. */
  discover: (url: string, scenarioId?: string) =>
    request<DiscoveryResponse>('/discovery', {
      method: 'POST',
      body: JSON.stringify({ url, ...(scenarioId ? { scenarioId } : {}) }),
    }),

  runScenarioForResult: (runId: string, caseId: string, scenarioId?: string) =>
    request<TestRunDetail>(`/test-runs/${runId}/results/${caseId}/run-scenario`, {
      method: 'POST',
      body: JSON.stringify(scenarioId ? { scenarioId } : {}),
    }),
};
