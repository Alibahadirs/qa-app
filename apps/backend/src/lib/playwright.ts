import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { HttpError } from './errors.js';

const run = promisify(execFile);

/** Playwright projesinin kökü: apps/e2e */
export const E2E_DIR = resolve(import.meta.dirname, '../../../e2e');

const TIMEOUT_MS = 120_000;

export interface AutomationOutcome {
  status: 'PASS' | 'FAIL';
  durationMs: number;
  notes: string | null;
}

/**
 * `playwrightScriptPath`'i apps/e2e içine hapseder. Mutlak yollar ve `..` ile
 * dışarı çıkma denemeleri reddedilir.
 */
export function resolveScriptPath(scriptPath: string): string {
  if (isAbsolute(scriptPath)) {
    throw new HttpError(400, 'Script yolu göreli olmalı (apps/e2e içine göre).');
  }
  const normalized = normalize(scriptPath);
  if (normalized.startsWith('..') || normalized.split(sep).includes('..')) {
    throw new HttpError(400, 'Script yolu apps/e2e dizininin dışına çıkamaz.');
  }
  const full = join(E2E_DIR, normalized);
  if (!full.startsWith(E2E_DIR + sep)) {
    throw new HttpError(400, 'Script yolu apps/e2e dizininin dışına çıkamaz.');
  }
  if (!existsSync(full)) {
    throw new HttpError(400, `Playwright dosyası bulunamadı: ${normalized}`);
  }
  return normalized;
}

interface PlaywrightJsonReport {
  stats?: { expected?: number; unexpected?: number; duration?: number };
  suites?: unknown;
  errors?: { message?: string }[];
}

/** Playwright'ın JSON raporundaki ilk hata mesajını bulur (ANSI kodları temizlenir). */
function firstErrorMessage(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = firstErrorMessage(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object' || node === null) return null;

  const obj = node as Record<string, unknown>;
  const err = obj.error as { message?: string } | undefined;
  if (err?.message) return err.message;

  for (const key of ['suites', 'specs', 'tests', 'results']) {
    const found = firstErrorMessage(obj[key]);
    if (found) return found;
  }
  return null;
}

const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '');

/**
 * `npx playwright test <dosya> --reporter=json` çalıştırır ve raporu yorumlar.
 * Playwright test başarısız olduğunda sıfırdan farklı çıkış kodu döner; bu bir
 * çalıştırma hatası değil, FAIL sonucudur — stdout yine de JSON içerir.
 */
export async function runPlaywrightSpec(scriptPath: string): Promise<AutomationOutcome> {
  const started = Date.now();
  let stdout = '';

  try {
    const result = await run('npx', ['playwright', 'test', scriptPath, '--reporter=json'], {
      cwd: E2E_DIR,
      timeout: TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
    });
    stdout = result.stdout;
  } catch (err) {
    const e = err as { stdout?: string; killed?: boolean; code?: string };
    if (e.killed || e.code === 'ETIMEDOUT') {
      return {
        status: 'FAIL',
        durationMs: Date.now() - started,
        notes: `Playwright ${TIMEOUT_MS / 1000} saniyede tamamlanmadı, süreç durduruldu.`,
      };
    }
    stdout = e.stdout ?? '';
  }

  const durationMs = Date.now() - started;
  const jsonStart = stdout.indexOf('{');
  if (jsonStart === -1) {
    return {
      status: 'FAIL',
      durationMs,
      notes: 'Playwright JSON raporu üretmedi. Kurulum eksik olabilir (npx playwright install).',
    };
  }

  let report: PlaywrightJsonReport;
  try {
    report = JSON.parse(stdout.slice(jsonStart)) as PlaywrightJsonReport;
  } catch {
    return { status: 'FAIL', durationMs, notes: 'Playwright raporu ayrıştırılamadı.' };
  }

  const expected = report.stats?.expected ?? 0;
  const unexpected = report.stats?.unexpected ?? 0;
  const reportedDuration = Math.round(report.stats?.duration ?? 0) || durationMs;

  if (unexpected === 0 && expected > 0) {
    return { status: 'PASS', durationMs: reportedDuration, notes: null };
  }

  const message =
    firstErrorMessage(report.suites) ??
    report.errors?.[0]?.message ??
    (expected === 0 ? 'Dosyada çalıştırılabilir test bulunamadı.' : 'Test başarısız.');

  return {
    status: 'FAIL',
    durationMs: reportedDuration,
    notes: stripAnsi(message).trim().slice(0, 2000),
  };
}
