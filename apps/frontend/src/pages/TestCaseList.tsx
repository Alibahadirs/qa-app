import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, exportUrl } from '../api/client.js';
import { PRIORITIES, PRIORITY_LABELS, type Priority, type TestCase } from '../api/types.js';
import {
  Alert,
  EmptyState,
  PriorityBadge,
  Spinner,
  Tag,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

type AutomatableFilter = 'all' | 'true' | 'false';

export function TestCaseList() {
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [tag, setTag] = useState('');
  const [automatable, setAutomatable] = useState<AutomatableFilter>('all');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(priority ? { priority } : {}),
      ...(tag ? { tag } : {}),
      ...(automatable === 'all' ? {} : { isAutomatable: automatable === 'true' }),
    }),
    [q, priority, tag, automatable],
  );

  const { data, loading, error, reload } = useAsync<TestCase[]>(
    () => api.listTestCases(filters),
    [JSON.stringify(filters)],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of data ?? []) for (const t of c.tags) set.add(t);
    return [...set].sort();
  }, [data]);

  const handleDelete = async (testCase: TestCase) => {
    if (!window.confirm(`"${testCase.title}" silinsin mi?`)) return;
    setDeleteError(null);
    try {
      await api.deleteTestCase(testCase.id);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  const hasFilters = Boolean(q || priority || tag || automatable !== 'all');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Test Case'ler</h2>
        <div className="flex gap-2">
          <a href={exportUrl.testCases()} className={secondaryButton} data-testid="export-cases">
            CSV indir
          </a>
          <Link to="/test-cases/new" className={primaryButton} data-testid="new-case">
            + Yeni Test Case
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Başlıkta ara…"
          className={inputClass}
          data-testid="filter-q"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | '')}
          className={inputClass}
          data-testid="filter-priority"
        >
          <option value="">Tüm öncelikler</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className={inputClass}
          data-testid="filter-tag"
        >
          <option value="">Tüm etiketler</option>
          {tag && !allTags.includes(tag) ? <option value={tag}>{tag}</option> : null}
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={automatable}
          onChange={(e) => setAutomatable(e.target.value as AutomatableFilter)}
          className={inputClass}
          data-testid="filter-automatable"
        >
          <option value="all">Otomasyon: hepsi</option>
          <option value="true">Otomatize edilebilir</option>
          <option value="false">Sadece manuel</option>
        </select>
      </div>

      {deleteError && <Alert>{deleteError}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <EmptyState>
          {hasFilters
            ? 'Filtrelerle eşleşen test case bulunamadı.'
            : 'Henüz test case yok. "Yeni Test Case" ile başlayın.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Başlık</th>
                <th className="px-4 py-2.5 font-medium">Öncelik</th>
                <th className="px-4 py-2.5 font-medium">Etiketler</th>
                <th className="px-4 py-2.5 font-medium">Adım</th>
                <th className="px-4 py-2.5 font-medium">Otomasyon</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100" data-testid="case-rows">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/test-cases/${c.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{c.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={c.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.length === 0 ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        c.tags.map((t) => <Tag key={t}>{t}</Tag>)
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.steps.length}</td>
                  <td className="px-4 py-3">
                    {c.isAutomatable ? (
                      <span className="text-xs font-medium text-emerald-700">Evet</span>
                    ) : (
                      <span className="text-xs text-slate-400">Manuel</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link to={`/test-cases/${c.id}`} className={`${secondaryButton} mr-1.5`}>
                      Düzenle
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c)}
                      className={dangerButton}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.length > 0 && (
        <p className="text-xs text-slate-500">{data.length} kayıt gösteriliyor.</p>
      )}
    </div>
  );
}
