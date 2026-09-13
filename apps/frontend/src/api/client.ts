import type {
  TestCase,
  TestCaseFilters,
  TestCaseInput,
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
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
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

export const api = {
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
};
