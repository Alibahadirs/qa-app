import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import type { ScenarioTemplate } from '../api/types.js';
import { Section } from '../components/scenarioUi.js';
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

/**
 * Şablon, metin dilindeki bir senaryo gövdesidir. Adımlar element id'lerine bağlı
 * olduğu ve id'ler senaryoya özel olduğu için şablon **etiketlerle** taşınır:
 * aynı etiketleri taşıyan sayfalarda doğrudan tutar, tutmazsa metin editöre düşer.
 */
export function TemplateList() {
  const { data, loading, error, reload } = useAsync<ScenarioTemplate[]>(
    () => api.listTemplates(),
    [],
  );
  const navigate = useNavigate();

  const [applying, setApplying] = useState<ScenarioTemplate | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const openApply = (template: ScenarioTemplate) => {
    setApplying(template);
    setScenarioName(template.name);
    setBaseUrl('');
    setMessage(null);
    setFailed(false);
  };

  const apply = async (e: FormEvent) => {
    e.preventDefault();
    if (!applying) return;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const result = await api.applyTemplate(applying.id, {
        name: scenarioName.trim(),
        baseUrl: baseUrl.trim(),
      });
      if (result.applied) {
        navigate(`/scenarios/${result.scenarioId}`);
        return;
      }
      // Beklenen durum: etiketler tutmadı. Senaryo kuruldu, metin editöre düşecek.
      navigate(`/scenarios/${result.scenarioId}`, {
        state: { templateText: result.text, templateErrors: result.errors },
      });
    } catch (err) {
      setFailed(true);
      setMessage(err instanceof Error ? err.message : 'Şablon uygulanamadı');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (template: ScenarioTemplate) => {
    if (!window.confirm(`"${template.name}" şablonu silinsin mi?`)) return;
    try {
      await api.deleteTemplate(template.id);
      reload();
    } catch (err) {
      setFailed(true);
      setMessage(err instanceof Error ? err.message : 'Silinemedi');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Senaryo şablonları</h2>
        <p className="text-sm text-slate-500">
          Bir kez kurulan senaryo gövdesini başka adreslerde yeniden kullanın.
        </p>
      </div>

      {message && <Alert kind={failed ? 'error' : 'info'}>{message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading && <Spinner />}

      {applying && (
        <Section
          title={`"${applying.name}" şablonundan senaryo kur`}
          description="Adres taranır, sonra şablon metni o sayfanın kataloğuna göre çözülür."
          actions={
            <button type="button" onClick={() => setApplying(null)} className={secondaryButton}>
              Vazgeç
            </button>
          }
        >
          <form onSubmit={(e) => void apply(e)} className="space-y-4">
            <Field label="Senaryo adı">
              <input
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                required
                className={inputClass}
              />
            </Field>
            <Field
              label="Başlangıç adresi"
              hint="Şablondaki etiketler bu sayfada bulunamazsa senaryo adımsız kurulur ve metni düzeltmeniz için editöre düşer."
            >
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
                placeholder="https://ornek.com/giris"
                className={inputClass}
              />
            </Field>
            <button
              type="submit"
              disabled={busy}
              className={primaryButton}
              data-testid="apply-template"
            >
              {busy ? 'Kuruluyor…' : 'Kur'}
            </button>
          </form>
        </Section>
      )}

      {data && data.length === 0 && (
        <EmptyState>
          Henüz şablon yok. Bir senaryo detayında "Şablon olarak kaydet" ile ilkini oluşturun.
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2" data-testid="template-rows">
          {data.map((template) => (
            <li key={template.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-slate-500">{template.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">
                    {template.stepCount} adım
                    {template.usedVariables.length > 0 &&
                      ` · değişkenler: ${template.usedVariables.join(', ')}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openApply(template)}
                    className={primaryButton}
                  >
                    Senaryo kur
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(template)}
                    className={dangerButton}
                  >
                    Sil
                  </button>
                </div>
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
                {template.text}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
