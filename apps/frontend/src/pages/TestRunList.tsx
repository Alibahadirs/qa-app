import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { TestRunSummary } from '../api/types.js';
import {
  Alert,
  EmptyState,
  Spinner,
  dangerButton,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { CountsLine, ProgressBar, RunStatusBadge, formatDate } from '../components/runUi.js';
import { useAsync } from '../hooks/useAsync.js';

export function TestRunList() {
  const { data, loading, error, reload } = useAsync<TestRunSummary[]>(
    () => api.listTestRuns(),
    [],
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async (run: TestRunSummary) => {
    if (!window.confirm(`"${run.name}" run'ı ve ekran görüntüleri silinsin mi?`)) return;
    setActionError(null);
    try {
      await api.deleteTestRun(run.id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Test Run'ları</h2>
        <Link to="/test-runs/new" className={primaryButton} data-testid="new-run">
          + Yeni Run
        </Link>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <EmptyState>Henüz test run yok. "Yeni Run" ile bir suite çalıştırın.</EmptyState>
      ) : (
        <ul className="space-y-3" data-testid="run-rows">
          {data.map((run) => (
            <li key={run.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
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
                <div className="flex items-center gap-2">
                  <RunStatusBadge status={run.status} />
                  <Link to={`/test-runs/${run.id}`} className={secondaryButton}>
                    {run.status === 'IN_PROGRESS' ? 'Devam et' : 'Aç'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(run)}
                    className={dangerButton}
                  >
                    Sil
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <ProgressBar counts={run.counts} total={run.total} />
                <CountsLine counts={run.counts} total={run.total} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
