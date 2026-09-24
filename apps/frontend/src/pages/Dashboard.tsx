import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import {
  BROWSER_LABELS,
  PRIORITY_LABELS,
  RESULT_LABELS,
  type Priority,
  type Stats,
} from '../api/types.js';
import { CountsLine, ProgressBar, RunStatusBadge, formatDate } from '../components/runUi.js';
import { Alert, EmptyState, Spinner, secondaryButton } from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

const PRIORITY_BARS: Record<Priority, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-sky-500',
  HIGH: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

function Tile({
  label,
  value,
  sub,
  to,
}: {
  label: string;
  value: string | number;
  sub?: string;
  to?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </>
  );
  const cls = 'rounded-lg border border-slate-200 bg-white p-4';
  return to ? (
    <Link to={to} className={`${cls} block transition hover:border-slate-300 hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Yatay oranlı çubuk — ayrı bir grafik kütüphanesine gerek yok. */
function Bars({
  rows,
}: {
  rows: { key: string; label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);

  if (total === 0) {
    return <p className="text-sm text-slate-400">Veri yok.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-slate-600">{r.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span
              className={`block h-full rounded-full ${r.color}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="w-14 shrink-0 text-right tabular-nums text-slate-700">
            {r.value}
            <span className="ml-1 text-xs text-slate-400">
              {total > 0 ? `${Math.round((r.value / total) * 100)}%` : ''}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const { data, loading, error } = useAsync<Stats>(() => api.getStats(), []);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  const { totals, passRate, resultTotals, priority, execution, recentRuns, selectorDrift, scenarioHealth } =
    data;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Genel Bakış</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Test case"
          value={totals.cases}
          sub={`${totals.automatableCases} otomatize edilebilir`}
          to="/test-cases"
        />
        <Tile label="Suite" value={totals.suites} to="/test-suites" />
        <Tile
          label="Run"
          value={totals.runs}
          sub={totals.activeRuns > 0 ? `${totals.activeRuns} devam ediyor` : 'Aktif run yok'}
          to="/test-runs"
        />
        <Tile
          label="Başarı oranı"
          value={passRate === null ? '—' : `%${passRate}`}
          sub={
            passRate === null
              ? 'Henüz sonuç yok'
              : `${resultTotals.pass} geçti / ${resultTotals.fail} kaldı`
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">Önceliğe göre test case'ler</h3>
          <Bars
            rows={(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => ({
              key: p,
              label: PRIORITY_LABELS[p],
              value: priority[p] ?? 0,
              color: PRIORITY_BARS[p],
            }))}
          />
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">
            Çalıştırma türü
            <span className="ml-1 font-normal text-slate-400">(işaretlenmiş sonuçlar)</span>
          </h3>
          <Bars
            rows={[
              { key: 'MANUAL', label: 'Manuel', value: execution.MANUAL, color: 'bg-slate-400' },
              {
                key: 'AUTOMATED',
                label: 'Otomatik',
                value: execution.AUTOMATED,
                color: 'bg-emerald-500',
              },
            ]}
          />
          <p className="text-xs text-slate-500">
            Test case'lerin {totals.automatableCases}'i otomatize edilebilir,{' '}
            {totals.manualCases}'i manuel.
          </p>
        </section>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Senaryo sağlığı</h3>
            <p className="text-xs text-slate-500">
              {scenarioHealth.totals.scenarios} senaryo · {scenarioHealth.totals.scheduled}{' '}
              zamanlanmış · son 24 saatte {scenarioHealth.totals.ranLast24h} koşu
              {scenarioHealth.totals.neverRun > 0 &&
                ` · ${scenarioHealth.totals.neverRun} hiç çalıştırılmamış`}
            </p>
          </div>
          <Link to="/scenarios/schedules" className={secondaryButton}>
            Zamanlanmış koşular
          </Link>
        </div>

        {scenarioHealth.failing.length === 0 ? (
          <p className="text-sm text-slate-500">
            Son koşusu başarısız olan senaryo yok.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="dash-failing">
            {scenarioHealth.failing.map((s) => (
              <li key={s.id} className="rounded-md border border-rose-200 bg-rose-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/scenarios/${s.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {s.name}
                  </Link>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
                    {RESULT_LABELS[s.status]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(s.lastRunAt)} · {BROWSER_LABELS[s.browser]}
                    {s.trigger === 'SCHEDULED' && ' · zamanlanmış'}
                  </span>
                </div>
                {s.failedStep && (
                  <p className="mt-1 text-xs text-slate-600">
                    <code className="rounded bg-white px-1 py-0.5">{s.failedStep}</code>
                  </p>
                )}
                {s.error && <p className="mt-1 text-xs text-rose-800">{s.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectorDrift.scenarios.length > 0 && (
        <section className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-amber-900">
              ⚠ Seçici kayması olan senaryolar
            </h3>
            <Link to="/scenarios" className={secondaryButton}>
              Senaryolar
            </Link>
          </div>
          <p className="text-xs text-amber-900">
            Bu adımlarda ilk aday seçici tutmadı, yedek adayla bulundu. Senaryo geçti ama sayfa
            değişmiş olabilir — {selectorDrift.driftingSteps} adım, son çalıştırmalarda.
          </p>
          <ul className="space-y-2" data-testid="dash-drift">
            {selectorDrift.scenarios.map((scenario) => (
              <li key={scenario.id} className="rounded-md border border-amber-200 bg-white p-3">
                <Link
                  to={`/scenarios/${scenario.id}`}
                  className="text-sm font-medium text-slate-900 hover:underline"
                >
                  {scenario.name}
                </Link>
                <span className="ml-2 text-xs text-slate-500">{formatDate(scenario.lastRunAt)}</span>
                <ul className="mt-1 space-y-0.5">
                  {scenario.steps.map((step, i) => (
                    <li key={i} className="text-xs text-slate-600">
                      <code className="rounded bg-slate-100 px-1 py-0.5">{step.description}</code>
                      <span className="ml-1.5 text-amber-800">
                        {step.usedSelectorIndex + 1}. aday ile bulundu
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Son run'lar</h3>
          <Link to="/test-runs" className={secondaryButton}>
            Tümü
          </Link>
        </div>

        {recentRuns.length === 0 ? (
          <EmptyState>
            Henüz run yok.{' '}
            <Link to="/test-runs/new" className="underline">
              Bir suite çalıştırın
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-3" data-testid="dash-recent">
            {recentRuns.map((run) => (
              <li key={run.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/test-runs/${run.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {run.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {run.suite.name} · {formatDate(run.startedAt)}
                    </p>
                  </div>
                  <RunStatusBadge status={run.status} />
                </div>
                <div className="mt-3 space-y-1.5">
                  <ProgressBar counts={run.counts} total={run.total} />
                  <CountsLine counts={run.counts} total={run.total} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
