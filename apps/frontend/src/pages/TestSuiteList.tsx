import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { TestSuiteSummary } from '../api/types.js';
import {
  Alert,
  EmptyState,
  Field,
  Spinner,
  dangerButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

export function TestSuiteList() {
  const { data, loading, error, reload } = useAsync<TestSuiteSummary[]>(
    () => api.listTestSuites(),
    [],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.createTestSuite({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setName('');
      setDescription('');
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (suite: TestSuiteSummary) => {
    if (!window.confirm(`"${suite.name}" suite'i silinsin mi? Test case'ler silinmez.`)) return;
    try {
      await api.deleteTestSuite(suite.id);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Test Suite'leri</h2>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className={primaryButton}
          data-testid="new-suite"
        >
          {creating ? 'Vazgeç' : '+ Yeni Suite'}
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <Field label="Ad">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Örn. Smoke Suite"
              required
              maxLength={200}
              data-testid="suite-name"
            />
          </Field>
          <Field label="Açıklama" hint="İsteğe bağlı.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-16`}
              maxLength={2000}
              data-testid="suite-description"
            />
          </Field>
          <button type="submit" disabled={saving} className={primaryButton} data-testid="suite-save">
            {saving ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </form>
      )}

      {formError && <Alert>{formError}</Alert>}
      {error && <Alert>{error}</Alert>}

      {loading && !data ? (
        <Spinner />
      ) : !data || data.length === 0 ? (
        <EmptyState>Henüz suite yok. "Yeni Suite" ile oluşturun.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="suite-rows">
          {data.map((s) => (
            <li
              key={s.id}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <Link
                  to={`/test-suites/${s.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {s.name}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {s.description || 'Açıklama yok.'}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">{s.caseCount} test case</span>
                <div className="flex gap-1.5">
                  <Link to={`/test-suites/${s.id}`} className={secondaryButton}>
                    Aç
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s)}
                    className={dangerButton}
                  >
                    Sil
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
