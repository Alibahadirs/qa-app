import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { ScenarioSummary } from '../api/types.js';
import {
  Alert,
  EmptyState,
  Field,
  Spinner,
  dangerButton,
  inputClass,
  primaryButton,
} from '../components/ui.js';
import { useAsync } from '../hooks/useAsync.js';

export function ScenarioList() {
  const { data, loading, error, reload } = useAsync<ScenarioSummary[]>(
    () => api.listScenarios(),
    [],
  );

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.createScenario({ name: name.trim(), baseUrl: baseUrl.trim() });
      setName('');
      setBaseUrl('');
      setCreating(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scenario: ScenarioSummary) => {
    if (!window.confirm(`"${scenario.name}" senaryosu ve çalıştırma geçmişi silinsin mi?`)) return;
    try {
      await api.deleteScenario(scenario.id);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Senaryolar</h2>
          <p className="text-sm text-slate-500">
            Kod yazmadan adım adım kurulan otomasyon senaryoları.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className={primaryButton}
          data-testid="new-scenario"
        >
          {creating ? 'Vazgeç' : '+ Yeni Senaryo'}
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
              required
              className={inputClass}
              placeholder="Giriş akışı"
            />
          </Field>
          <Field label="Başlangıç adresi" hint="Senaryo bu sayfadan başlar ve burası kataloglanır.">
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              required
              className={inputClass}
              placeholder="https://ornek.com/giris"
            />
          </Field>
          <button type="submit" disabled={saving} className={primaryButton}>
            {saving ? 'Kaydediliyor…' : 'Oluştur'}
          </button>
        </form>
      )}

      {formError && <Alert>{formError}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {data && data.length === 0 && (
        <EmptyState>Henüz senaryo yok. Bir başlangıç adresi verip ilkini oluşturun.</EmptyState>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((scenario) => (
            <li
              key={scenario.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  to={`/scenarios/${scenario.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {scenario.name}
                </Link>
                <p className="truncate text-xs text-slate-500">{scenario.baseUrl}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{scenario.stepCount} adım</span>
                <span>{scenario.elementCount} element</span>
                <button
                  type="button"
                  onClick={() => void handleDelete(scenario)}
                  className={dangerButton}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
