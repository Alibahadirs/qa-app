import { type ChangeEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, resolveUploadUrl } from '../api/client.js';
import {
  MARKABLE_STATUSES,
  RESULT_LABELS,
  type ResultStatus,
  type TestRunDetail as RunDetail,
} from '../api/types.js';
import {
  CountsLine,
  ProgressBar,
  RESULT_STYLES,
  ResultBadge,
  RunStatusBadge,
  formatDate,
  formatDuration,
} from '../components/runUi.js';
import {
  Alert,
  PriorityBadge,
  Spinner,
  buttonClass,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

export function TestRunDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: run, loading, error, setData } = useAsync<RunDetail>(
    () => api.getTestRun(id),
    [id],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const active = run?.results[activeIndex];
  const editable = run?.status === 'IN_PROGRESS';

  // Aktif case değişince not alanı sunucudaki değere senkronlanır.
  useEffect(() => {
    setNotes(active?.notes ?? '');
  }, [active?.id, active?.notes]);

  const apply = async (fn: () => Promise<RunDetail>) => {
    setBusy(true);
    setActionError(null);
    try {
      setData(await fn());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const mark = async (status: ResultStatus) => {
    if (!active) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.updateResult(id, active.testCase.id, { status });
      setData(updated);

      // Bir sonuç işaretlendiğinde sıradaki bekleyen case'e geçilir.
      // "Temizle" (NOT_RUN) bir işaretleme değildir — kullanıcı o case'de kalmalı.
      if (status !== 'NOT_RUN') {
        const next = updated.results.findIndex(
          (r, i) => i > activeIndex && r.status === 'NOT_RUN',
        );
        if (next !== -1) setActiveIndex(next);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = () => {
    if (!active || notes === (active.notes ?? '')) return;
    void apply(() => api.updateResult(id, active.testCase.id, { notes: notes || null }));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !active) return;
    void apply(() => api.uploadScreenshot(id, active.testCase.id, file));
  };

  const finish = (status: 'COMPLETED' | 'ABORTED') => {
    const label = status === 'COMPLETED' ? 'tamamlansın' : 'iptal edilsin';
    const pending = run ? run.counts.NOT_RUN : 0;
    const warning =
      status === 'COMPLETED' && pending > 0
        ? `\n\n${pending} case hâlâ işaretlenmemiş. Tamamlandıktan sonra değiştirilemez.`
        : '';
    if (!window.confirm(`Run ${label} mı?${warning}`)) return;
    void apply(() => api.finishTestRun(id, status));
  };

  if (loading && !run) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!run) return null;

  const duration = formatDuration(run.startedAt, run.completedAt);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{run.name}</h2>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <Link to={`/test-suites/${run.suite.id}`} className="hover:underline">
              {run.suite.name}
            </Link>{' '}
            · Başlangıç {formatDate(run.startedAt)}
            {run.completedAt ? ` · Bitiş ${formatDate(run.completedAt)}` : ''}
            {duration ? ` · Süre ${duration}` : ''}
          </p>
        </div>
        <Link to="/test-runs" className={secondaryButton}>
          ← Run listesi
        </Link>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <ProgressBar counts={run.counts} total={run.total} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CountsLine counts={run.counts} total={run.total} />
          {editable ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => finish('COMPLETED')}
                className={primaryButton}
                data-testid="run-complete"
              >
                Run'ı tamamla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => finish('ABORTED')}
                className={dangerButton}
              >
                İptal et
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`"${run.name}" silinsin mi?`)) return;
                void api.deleteTestRun(id).then(() => navigate('/test-runs'));
              }}
              className={dangerButton}
            >
              Run'ı sil
            </button>
          )}
        </div>
        {!editable && (
          <p className="text-xs text-slate-500">
            Bu run kapatıldı; sonuçlar salt okunur.
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <nav className="rounded-lg border border-slate-200 bg-white p-2" aria-label="Case listesi">
          <ol data-testid="run-case-list">
            {run.results.map((r, index) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
                    index === activeIndex ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'
                  }`}
                  data-testid={`run-case-${index}`}
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${RESULT_STYLES[r.status].dot}`}
                    title={RESULT_LABELS[r.status]}
                  />
                  <span className="w-5 shrink-0 text-xs text-slate-400">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">
                    {r.testCase.title}
                  </span>
                  {r.screenshotUrl && (
                    <span className="shrink-0 text-xs text-slate-400" title="Ekran görüntüsü var">
                      🖼
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {active && (
          <section
            className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
            data-testid="run-active-case"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{active.testCase.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={active.testCase.priority} />
                  <ResultBadge status={active.status} />
                  <span className="text-xs text-slate-400">
                    {activeIndex + 1} / {run.total}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveIndex((i) => i - 1)}
                  className={secondaryButton}
                >
                  ← Önceki
                </button>
                <button
                  type="button"
                  disabled={activeIndex === run.total - 1}
                  onClick={() => setActiveIndex((i) => i + 1)}
                  className={secondaryButton}
                  data-testid="run-next"
                >
                  Sonraki →
                </button>
              </div>
            </div>

            {active.testCase.description && (
              <p className="text-sm text-slate-600">{active.testCase.description}</p>
            )}

            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-700">Adımlar</h4>
              {active.testCase.steps.length === 0 ? (
                <p className="text-sm text-slate-400">Adım tanımlanmamış.</p>
              ) : (
                <ol className="space-y-1.5">
                  {active.testCase.steps.map((step, i) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: sıralı, tekrar edebilen metin
                      key={`${step}-${i}`}
                      className="flex gap-2.5 text-sm text-slate-800"
                    >
                      <span className="w-5 shrink-0 text-slate-400">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-1 text-sm font-medium text-slate-700">Beklenen sonuç</h4>
              <p className="text-sm text-slate-800">{active.testCase.expectedResult}</p>
            </div>

            {editable && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-slate-700">Sonuç</h4>
                <div className="flex flex-wrap gap-2" data-testid="run-status-buttons">
                  {MARKABLE_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => void mark(s)}
                      className={`${buttonClass} ring-1 ring-inset ${RESULT_STYLES[s].badge} ${
                        active.status === s ? 'ring-2 ring-offset-1' : ''
                      }`}
                      data-testid={`mark-${s}`}
                    >
                      {RESULT_LABELS[s]}
                    </button>
                  ))}
                  {active.status !== 'NOT_RUN' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mark('NOT_RUN')}
                      className={secondaryButton}
                      data-testid="mark-reset"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-700">Not</h4>
              {editable ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Gözlem, hata mesajı, adım numarası…"
                  className={`${inputClass} min-h-24`}
                  maxLength={2000}
                  data-testid="run-notes"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-slate-700">
                  {active.notes || <span className="text-slate-400">Not girilmemiş.</span>}
                </p>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-700">Ekran görüntüsü</h4>
              {active.screenshotUrl ? (
                <div className="space-y-2">
                  <a
                    href={resolveUploadUrl(active.screenshotUrl) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-fit"
                  >
                    <img
                      src={resolveUploadUrl(active.screenshotUrl) ?? ''}
                      alt="Ekran görüntüsü"
                      className="max-h-64 rounded-md border border-slate-200"
                      data-testid="run-screenshot"
                    />
                  </a>
                  {editable && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void apply(() => api.deleteScreenshot(id, active.testCase.id))}
                      className={dangerButton}
                      data-testid="run-screenshot-remove"
                    >
                      Görüntüyü kaldır
                    </button>
                  )}
                </div>
              ) : editable ? (
                <label className={`${secondaryButton} cursor-pointer`}>
                  Görüntü seç (PNG/JPEG/WebP, ≤5 MB)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFile}
                    className="hidden"
                    data-testid="run-screenshot-input"
                  />
                </label>
              ) : (
                <p className="text-sm text-slate-400">Ekran görüntüsü yok.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
