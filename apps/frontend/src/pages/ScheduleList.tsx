import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { BROWSER_LABELS, type Stats } from '../api/types.js';
import { Alert, EmptyState, Spinner } from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

/** "Bu gece ne koşacak?" — açık zamanlamalar, sıradaki çalıştırma zamanına göre. */
export function ScheduleList() {
  const { data, loading, error } = useAsync<Stats>(() => api.getStats(), []);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!data) return null;

  const { upcoming } = data.scenarioHealth;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Zamanlanmış koşular</h2>
        <p className="text-sm text-slate-500">
          Açık zamanlamalar, sıradaki çalıştırma zamanına göre sıralı. Zamanlayıcı yalnızca
          sunucu ayaktayken tetiklenir; kapalı geçen zamanlar için sonradan koşu yapılmaz.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState>
          Açık zamanlama yok. Bir senaryo detayında zamanlama kurabilirsiniz.
        </EmptyState>
      ) : (
        <ul className="space-y-2" data-testid="schedule-rows">
          {upcoming.map((s) => (
            <li
              key={s.scenarioId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  to={`/scenarios/${s.scenarioId}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {s.scenarioName}
                </Link>
                <p className="text-xs text-slate-500">
                  {s.kind === 'INTERVAL'
                    ? `her ${s.intervalMinutes} dakikada bir`
                    : `her gün ${s.dailyAt}`}{' '}
                  · {BROWSER_LABELS[s.browser]}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p className="text-slate-700">
                  sıradaki: {new Date(s.nextRunAt).toLocaleString('tr-TR')}
                </p>
                <p>
                  {s.lastRunAt
                    ? `son: ${new Date(s.lastRunAt).toLocaleString('tr-TR')}`
                    : 'henüz zamanlayıcıyla çalışmadı'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
