import type { APIRequestContext } from '@playwright/test';

/**
 * Çekirdek modüllerin (case/suite/run) testleri için API yardımcıları.
 * `page.request` tarayıcının cookie'lerini paylaştığından auth açıkken de
 * globalSetup'ın sakladığı oturumla çalışır; ayrıca giriş gerekmez.
 */
export const API = '/api';

export const uniqueName = (prefix: string): string =>
  `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** Test verisini izler ve ters bağımlılık sırasıyla siler (run → suite → case). */
export class Fixture {
  private readonly runs: string[] = [];
  private readonly suites: string[] = [];
  private readonly cases: string[] = [];

  constructor(private readonly request: APIRequestContext) {}

  async testCase(title: string, extra: Record<string, unknown> = {}): Promise<{ id: string; tags: string[] }> {
    const res = await this.request.post(`${API}/test-cases`, {
      data: { title, expectedResult: 'Beklenen sonuç', steps: ['Adım'], ...extra },
    });
    if (!res.ok()) throw new Error(`case oluşturulamadı: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    this.cases.push(body.id);
    return body;
  }

  async suite(name: string, caseIds: string[]): Promise<{ id: string }> {
    const res = await this.request.post(`${API}/test-suites`, { data: { name, caseIds } });
    if (!res.ok()) throw new Error(`suite oluşturulamadı: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    this.suites.push(body.id);
    return body;
  }

  async run(suiteId: string): Promise<{ id: string }> {
    const res = await this.request.post(`${API}/test-runs`, { data: { suiteId } });
    if (!res.ok()) throw new Error(`run başlatılamadı: ${res.status()} ${await res.text()}`);
    const body = await res.json();
    this.runs.push(body.id);
    return body;
  }

  /** Arayüzden oluşturulan kayıtlar da temizliğe dahil edilsin diye. */
  track(kind: 'runs' | 'suites' | 'cases', id: string): void {
    this[kind].push(id);
  }

  async cleanup(): Promise<void> {
    for (const id of this.runs) await this.request.delete(`${API}/test-runs/${id}`);
    for (const id of this.suites) await this.request.delete(`${API}/test-suites/${id}`);
    for (const id of this.cases) await this.request.delete(`${API}/test-cases/${id}`);
  }
}
