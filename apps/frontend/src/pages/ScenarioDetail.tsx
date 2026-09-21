import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api, resolveUploadUrl } from '../api/client.js';
import type {
  ScenarioDetail,
  ScenarioRunDetail,
  ScenarioRunSummary,
  ScenarioStepInput,
  TestCase,
} from '../api/types.js';
import { RunReport, Section, StatusChip, StepEditor } from '../components/scenarioUi.js';
import {
  Alert,
  EmptyState,
  Spinner,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

const toInput = (scenario: ScenarioDetail): ScenarioStepInput[] =>
  scenario.steps.map((s) => ({
    action: s.action,
    targetElementId: s.targetElementId,
    value: s.value,
    timeoutMs: s.timeoutMs,
  }));

/** Metin kaydetme hatasında sunucunun döndürdüğü satır bazlı hatalar. */
interface ParseIssue {
  line: number;
  message: string;
}

function parseIssues(err: unknown): ParseIssue[] {
  if (!(err instanceof ApiError)) return [];
  const details = err.details as { errors?: ParseIssue[] } | undefined;
  return details?.errors ?? [];
}

export function ScenarioDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error, setData, reload } = useAsync<ScenarioDetail>(
    () => api.getScenario(id),
    [id],
  );
  const runs = useAsync<ScenarioRunSummary[]>(() => api.listScenarioRuns(id), [id]);
  const cases = useAsync<TestCase[]>(() => api.listTestCases(), []);

  const [mode, setMode] = useState<'form' | 'text'>('form');
  const [steps, setSteps] = useState<ScenarioStepInput[]>([]);
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'run' | 'discover'>(null);
  const [discoverUrl, setDiscoverUrl] = useState('');
  const [report, setReport] = useState<ScenarioRunDetail | null>(null);

  // Sunucudan gelen senaryo iki görünümün de kaynağıdır.
  useEffect(() => {
    if (!data) return;
    setSteps(toInput(data));
    setText(data.text);
    setDiscoverUrl((current) => current || data.baseUrl);
  }, [data]);

  if (loading) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  const apply = (updated: ScenarioDetail, note: string) => {
    setData(updated);
    setIssues([]);
    setMessage(note);
  };

  const fail = (err: unknown, fallback: string) => {
    setIssues(parseIssues(err));
    setMessage(err instanceof Error ? err.message : fallback);
  };

  const saveSteps = async () => {
    setBusy('save');
    setMessage(null);
    try {
      apply(
        mode === 'form'
          ? await api.saveScenarioSteps(id, steps)
          : await api.saveScenarioText(id, text),
        'Adımlar kaydedildi.',
      );
    } catch (err) {
      fail(err, 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  };

  const discover = async () => {
    setBusy('discover');
    setMessage(null);
    try {
      const result = await api.discover(discoverUrl.trim(), id);
      setMessage(`${result.count} element kataloglandı.`);
      reload();
    } catch (err) {
      fail(err, 'Sayfa taranamadı');
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setBusy('run');
    setMessage(null);
    try {
      setReport(await api.runScenario(id));
      runs.reload();
    } catch (err) {
      fail(err, 'Çalıştırılamadı');
    } finally {
      setBusy(null);
    }
  };

  const bindCase = async (testCaseId: string | null) => {
    try {
      apply(await api.updateScenario(id, { testCaseId }), 'Test case bağlantısı güncellendi.');
    } catch (err) {
      fail(err, 'Bağlantı kurulamadı');
    }
  };

  const showRun = async (runId: string) => {
    try {
      setReport(await api.getScenarioRun(id, runId));
    } catch (err) {
      fail(err, 'Rapor açılamadı');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/scenarios" className="text-xs text-slate-500 hover:underline">
            ← Senaryolar
          </Link>
          <h2 className="text-xl font-semibold">{data.name}</h2>
          <p className="truncate text-sm text-slate-500">{data.baseUrl}</p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy !== null}
          className={primaryButton}
          data-testid="run-scenario"
        >
          {busy === 'run' ? 'Çalışıyor…' : '▶ Çalıştır'}
        </button>
      </div>

      {message && <Alert kind={issues.length > 0 ? 'error' : 'info'}>{message}</Alert>}

      {issues.length > 0 && (
        <ul className="space-y-1 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {issues.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>
              <strong>Satır {issue.line}:</strong> {issue.message}
            </li>
          ))}
        </ul>
      )}

      {data.warnings.map((warning) => (
        <Alert key={warning} kind="info">
          {warning}
        </Alert>
      ))}

      <Section
        title="Adımlar"
        description="Aynı senaryo hem form hem metin olarak düzenlenebilir; ikisi arasında kayıpsız geçilir."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                // Görünüm değişirken kaydedilmemiş form değişiklikleri kaybolmasın diye
                // sunucudaki son hâle dönülür.
                setSteps(toInput(data));
                setText(data.text);
                setMode(mode === 'form' ? 'text' : 'form');
                setIssues([]);
              }}
              className={secondaryButton}
            >
              {mode === 'form' ? 'Metin görünümü' : 'Form görünümü'}
            </button>
            <button
              type="button"
              onClick={() => void saveSteps()}
              disabled={busy !== null}
              className={primaryButton}
              data-testid="save-steps"
            >
              {busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        }
      >
        {mode === 'form' ? (
          <div className="space-y-3">
            <StepEditor steps={steps} elements={data.elements} onChange={setSteps} />
            <button
              type="button"
              onClick={() =>
                setSteps([
                  ...steps,
                  { action: 'CLICK', targetElementId: null, value: null, timeoutMs: null },
                ])
              }
              className={secondaryButton}
            >
              + Adım ekle
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={Math.max(8, text.split('\n').length + 2)}
              spellCheck={false}
              className={`${inputClass} font-mono text-xs`}
              aria-label="Senaryo metni"
            />
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer">Komut listesi</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                <li><code>git: https://ornek.com/giris</code></li>
                <li><code>tikla: Giriş yap</code></li>
                <li><code>yaz: E-posta = test@ornek.com</code></li>
                <li><code>sec: Rol = admin</code></li>
                <li><code>bekle: 1500ms</code></li>
                <li><code>bekle: url içerir /panel</code></li>
                <li><code>bekle: gorunur = Çıkış</code></li>
                <li><code>dogrula: metin = Hoş geldiniz</code></li>
                <li><code>dogrula: gorunur = Çıkış</code></li>
                <li><code>dogrula: gizli = Hata mesajı</code></li>
                <li><code>dogrula: url içerir /panel</code></li>
                <li><code>dogrula: deger: E-posta = a@b.c</code></li>
              </ul>
              <p className="mt-2">
                Hedefler element etiketiyle yazılır; <code>{'{{degisken}}'}</code> ile parametre
                kullanılır.
              </p>
            </details>
          </div>
        )}
      </Section>

      <Section
        title="Element kataloğu"
        description="Adımların hedefleri buradan gelir. Senaryo yeni bir sayfaya geçtiğinde o sayfa kendiliğinden kataloglanır."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={discoverUrl}
              onChange={(e) => setDiscoverUrl(e.target.value)}
              className={`${inputClass} w-72`}
              aria-label="Taranacak adres"
            />
            <button
              type="button"
              onClick={() => void discover()}
              disabled={busy !== null}
              className={secondaryButton}
              data-testid="discover"
            >
              {busy === 'discover' ? 'Taranıyor…' : 'Sayfayı tara'}
            </button>
          </div>
        }
      >
        {data.elements.length === 0 ? (
          <EmptyState>
            Katalog boş. Başlangıç adresini tarayarak elementleri çıkarın.
          </EmptyState>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.elements.map((el) => (
              <li key={el.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{el.label}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {el.role} · {el.tagName}
                </span>
                <p className="truncate text-xs text-slate-400">{el.pageUrl}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Test case bağlantısı"
        description="Senaryo bir test case'e bağlanırsa, test run'ı içinden tek tıkla çalıştırılabilir."
      >
        <select
          value={data.testCaseId ?? ''}
          onChange={(e) => void bindCase(e.target.value || null)}
          className={`${inputClass} max-w-md`}
          aria-label="Bağlı test case"
        >
          <option value="">— bağlı değil —</option>
          {(cases.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Section>

      {data.usedVariables.length > 0 && (
        <Section
          title="Değişkenler"
          description="Senaryo metninde geçen {{degisken}} adları. Gizli değerler sunucuda tutulur, yanıtlarda gösterilmez."
        >
          <ul className="space-y-1 text-sm">
            {data.usedVariables.map((name) => {
              const stored = data.variables.find((v) => v.name === name);
              return (
                <li key={name} className="flex items-center gap-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{`{{${name}}}`}</code>
                  {stored ? (
                    <span className="text-xs text-slate-500">
                      {stored.secret ? 'gizli değer tanımlı' : `değer: ${stored.value ?? ''}`}
                    </span>
                  ) : (
                    <span className="text-xs text-rose-700">değer tanımlı değil</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {report && (
        <Section
          title="Çalıştırma raporu"
          description={`${report.summary.passed}/${report.summary.total} adım geçti · ${report.summary.selectorDrifts} seçici kayması`}
          actions={<StatusChip status={report.status} />}
        >
          {report.error && <Alert>{report.error}</Alert>}
          <RunReport steps={report.steps} resolveUpload={resolveUploadUrl} />
        </Section>
      )}

      <Section title="Çalıştırma geçmişi">
        {runs.data && runs.data.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {runs.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3">
                <StatusChip status={r.status} />
                <button
                  type="button"
                  onClick={() => void showRun(r.id)}
                  className="text-slate-700 hover:underline"
                >
                  {new Date(r.startedAt).toLocaleString('tr-TR')}
                </button>
                <span className="text-xs text-slate-500">
                  {r.stepCount} adım · {r.failedCount} başarısız
                  {r.selectorDrifts > 0 && ` · ${r.selectorDrifts} seçici kayması`}
                  {r.durationMs !== null && ` · ${(r.durationMs / 1000).toFixed(1)} sn`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Bu senaryo henüz çalıştırılmadı.</EmptyState>
        )}
      </Section>
    </div>
  );
}
