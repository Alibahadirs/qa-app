import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import type { TestSuiteSummary } from '../api/types.js';
import {
  Alert,
  EmptyState,
  Field,
  Spinner,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

export function TestRunNew() {
  const navigate = useNavigate();
  const { data: suites, loading, error } = useAsync<TestSuiteSummary[]>(
    () => api.listTestSuites(),
    [],
  );

  const [searchParams] = useSearchParams();
  const [suiteId, setSuiteId] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const runnable = (suites ?? []).filter((s) => s.caseCount > 0);
  const selected = runnable.find((s) => s.id === suiteId);

  // Ön seçim: ?suiteId= ile gelindiyse o suite, tek seçenek varsa o seçilir.
  // Seçimsiz butonun pasif kalması "tepki vermiyor" gibi görünüyordu.
  // Yalnız suite'ler yüklendiğinde bir kez çalışır; kullanıcı seçimi boşaltırsa geri doldurulmaz.
  useEffect(() => {
    if (!suites) return;
    const options = suites.filter((s) => s.caseCount > 0);
    const requested = searchParams.get('suiteId');
    const preset =
      options.find((s) => s.id === requested) ?? (options.length === 1 ? options[0] : undefined);
    if (preset) setSuiteId(preset.id);
  }, [suites, searchParams]);

  // Kullanıcı adı elle değiştirmediği sürece suite adına göre öneri güncellenir.
  useEffect(() => {
    if (nameTouched || !selected) return;
    setName(`${selected.name} — ${new Date().toLocaleDateString('tr-TR')}`);
  }, [selected, nameTouched]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const run = await api.createTestRun({
        suiteId,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      navigate(`/test-runs/${run.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Run başlatılamadı');
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Yeni Test Run</h2>
        <Link to="/test-runs" className={secondaryButton}>
          ← Run listesi
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}
      {formError && <Alert>{formError}</Alert>}

      {runnable.length === 0 ? (
        <EmptyState>
          Çalıştırılabilir suite yok — bir suite oluşturup içine test case ekleyin.{' '}
          <Link to="/test-suites" className="underline">
            Suite'lere git
          </Link>
        </EmptyState>
      ) : (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
        >
          <Field label="Suite" hint="Boş suite'ler listelenmez.">
            <select
              value={suiteId}
              onChange={(e) => setSuiteId(e.target.value)}
              className={inputClass}
              required
              data-testid="run-suite"
            >
              <option value="">Suite seçin…</option>
              {runnable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.caseCount} case)
                </option>
              ))}
            </select>
          </Field>

          <Field label="Run adı">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              className={inputClass}
              maxLength={200}
              placeholder="Boş bırakılırsa otomatik oluşturulur"
              data-testid="run-name"
            />
          </Field>

          {selected && (
            <p className="text-sm text-slate-600">
              <strong>{selected.caseCount}</strong> test case sıraya alınacak. Suite sonradan
              değişse de bu run'ın sırası ve içeriği sabit kalır.
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !suiteId}
            className={primaryButton}
            data-testid="run-start"
          >
            {saving ? 'Başlatılıyor…' : "Run'ı başlat"}
          </button>
        </form>
      )}
    </div>
  );
}
