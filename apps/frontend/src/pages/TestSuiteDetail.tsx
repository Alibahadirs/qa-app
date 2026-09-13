import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import type { TestCase, TestSuiteDetail as SuiteDetail } from '../api/types.js';
import {
  Alert,
  EmptyState,
  Field,
  PriorityBadge,
  Spinner,
  Tag,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

export function TestSuiteDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: suite, loading, error, setData } = useAsync<SuiteDetail>(
    () => api.getTestSuite(id),
    [id],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allCases, setAllCases] = useState<TestCase[] | null>(null);

  useEffect(() => {
    if (!suite) return;
    setName(suite.name);
    setDescription(suite.description ?? '');
  }, [suite]);

  const suiteCaseIds = useMemo(
    () => new Set((suite?.cases ?? []).map((c) => c.id)),
    [suite],
  );

  const available = useMemo(
    () => (allCases ?? []).filter((c) => !suiteCaseIds.has(c.id)),
    [allCases, suiteCaseIds],
  );

  const run = async (fn: () => Promise<SuiteDetail | void>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await fn();
      if (result) setData(result);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    setPicking(true);
    setSelected(new Set());
    if (allCases) return;
    try {
      setAllCases(await api.listTestCases());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Test case listesi alınamadı');
    }
  };

  const move = (index: number, delta: number) => {
    if (!suite) return;
    const ids = suite.cases.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const [item] = ids.splice(index, 1);
    ids.splice(target, 0, item as string);
    void run(() => api.reorderSuiteCases(id, ids));
  };

  if (loading && !suite) return <Spinner />;
  if (error) return <Alert>{error}</Alert>;
  if (!suite) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{suite.name}</h2>
        <Link to="/test-suites" className={secondaryButton}>
          ← Suite listesi
        </Link>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">Suite bilgileri</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ad">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              maxLength={200}
              data-testid="suite-edit-name"
            />
          </Field>
          <Field label="Açıklama">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              maxLength={2000}
              data-testid="suite-edit-description"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(() =>
                api.updateTestSuite(id, { name: name.trim(), description: description.trim() }),
              )
            }
            className={primaryButton}
            data-testid="suite-edit-save"
          >
            Kaydet
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`"${suite.name}" silinsin mi?`)) return;
              void api.deleteTestSuite(id).then(() => navigate('/test-suites'));
            }}
            className={dangerButton}
          >
            Suite'i sil
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Test case'ler ({suite.cases.length})
          </h3>
          <button
            type="button"
            onClick={() => (picking ? setPicking(false) : void openPicker())}
            className={secondaryButton}
            data-testid="toggle-picker"
          >
            {picking ? 'Kapat' : '+ Case ekle'}
          </button>
        </div>

        {picking && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            {available.length === 0 ? (
              <p className="text-sm text-slate-500">
                Eklenebilecek başka test case yok.{' '}
                <Link to="/test-cases/new" className="underline">
                  Yeni oluştur
                </Link>
              </p>
            ) : (
              <>
                <ul className="mb-3 max-h-64 space-y-1 overflow-y-auto" data-testid="picker-list">
                  {available.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-white">
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setSelected(next);
                          }}
                          className="size-4 rounded border-slate-300"
                        />
                        <span className="flex-1 text-slate-800">{c.title}</span>
                        <PriorityBadge priority={c.priority} />
                      </label>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy || selected.size === 0}
                  onClick={() =>
                    void run(async () => {
                      const updated = await api.addCasesToSuite(id, [...selected]);
                      setPicking(false);
                      setSelected(new Set());
                      return updated;
                    })
                  }
                  className={primaryButton}
                  data-testid="picker-add"
                >
                  Seçilenleri ekle ({selected.size})
                </button>
              </>
            )}
          </div>
        )}

        {suite.cases.length === 0 ? (
          <EmptyState>Bu suite boş. "Case ekle" ile test case bağlayın.</EmptyState>
        ) : (
          <ol className="divide-y divide-slate-100" data-testid="suite-cases">
            {suite.cases.map((c, index) => (
              <li key={c.id} className="flex items-start gap-3 py-3">
                <span className="w-6 pt-0.5 text-sm text-slate-400">{index + 1}.</span>
                <div className="flex-1">
                  <Link
                    to={`/test-cases/${c.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {c.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={c.priority} />
                    {c.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    {c.isAutomatable && (
                      <span className="text-xs font-medium text-emerald-700">otomasyon</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Yukarı taşı"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    className="px-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Aşağı taşı"
                    disabled={busy || index === suite.cases.length - 1}
                    onClick={() => move(index, 1)}
                    className="px-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.removeCaseFromSuite(id, c.id))}
                    className="ml-1 px-1.5 text-slate-400 hover:text-rose-600"
                    aria-label="Suite'ten çıkar"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
