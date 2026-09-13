import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
  type TestCase,
  type TestCaseInput,
} from '../api/types.js';
import { StringListInput } from '../components/StringListInput.js';
import {
  Alert,
  Field,
  Spinner,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../components/ui.js';

const EMPTY: TestCaseInput = {
  title: '',
  description: '',
  steps: [],
  expectedResult: '',
  priority: 'MEDIUM',
  tags: [],
  isAutomatable: false,
  playwrightScriptPath: '',
};

export function TestCaseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<TestCaseInput>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setForm(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getTestCase(id)
      .then((c: TestCase) => {
        if (cancelled) return;
        setForm({
          title: c.title,
          description: c.description ?? '',
          steps: c.steps,
          expectedResult: c.expectedResult,
          priority: c.priority,
          tags: c.tags,
          isAutomatable: c.isAutomatable,
          playwrightScriptPath: c.playwrightScriptPath ?? '',
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const patch = (changes: Partial<TestCaseInput>) => setForm((f) => ({ ...f, ...changes }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Boş opsiyonel alanlar backend'e gönderilmez (zod min(1) doğrulamasına takılmasın).
    const payload: TestCaseInput = {
      ...form,
      title: form.title.trim(),
      expectedResult: form.expectedResult.trim(),
    };
    if (!payload.description?.trim()) delete payload.description;
    if (!payload.isAutomatable || !payload.playwrightScriptPath?.trim()) {
      delete payload.playwrightScriptPath;
    }

    try {
      if (id) {
        await api.updateTestCase(id, {
          ...payload,
          description: payload.description ?? '',
          playwrightScriptPath: payload.playwrightScriptPath ?? '',
        });
      } else {
        await api.createTestCase(payload);
      }
      navigate('/test-cases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {isEdit ? 'Test Case Düzenle' : 'Yeni Test Case'}
        </h2>
        <Link to="/test-cases" className={secondaryButton}>
          ← Listeye dön
        </Link>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <Field label="Başlık">
          <input
            type="text"
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            className={inputClass}
            placeholder="Örn. Geçerli kimlik bilgileriyle giriş yapılabiliyor"
            required
            maxLength={200}
            data-testid="case-title"
          />
        </Field>

        <Field label="Açıklama" hint="İsteğe bağlı — ön koşullar, bağlam.">
          <textarea
            value={form.description ?? ''}
            onChange={(e) => patch({ description: e.target.value })}
            className={`${inputClass} min-h-20`}
            maxLength={2000}
            data-testid="case-description"
          />
        </Field>

        <Field label="Adımlar" hint="Enter ile de ekleyebilirsiniz; ↑↓ ile sırayı değiştirin.">
          <StringListInput
            value={form.steps}
            onChange={(steps) => patch({ steps })}
            placeholder="Örn. Giriş sayfasını aç"
            ordered
            testId="case-steps"
          />
        </Field>

        <Field label="Beklenen Sonuç">
          <textarea
            value={form.expectedResult}
            onChange={(e) => patch({ expectedResult: e.target.value })}
            className={`${inputClass} min-h-20`}
            required
            maxLength={2000}
            data-testid="case-expected"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Öncelik">
            <select
              value={form.priority}
              onChange={(e) => patch({ priority: e.target.value as Priority })}
              className={inputClass}
              data-testid="case-priority"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Etiketler">
            <StringListInput
              value={form.tags}
              onChange={(tags) => patch({ tags })}
              placeholder="Örn. regression"
              testId="case-tags"
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.isAutomatable}
              onChange={(e) => patch({ isAutomatable: e.target.checked })}
              className="size-4 rounded border-slate-300"
              data-testid="case-automatable"
            />
            Otomatize edilebilir
          </label>

          {form.isAutomatable && (
            <Field label="Playwright script yolu" hint="Faz 4'te bu dosya çalıştırılacak.">
              <input
                type="text"
                value={form.playwrightScriptPath ?? ''}
                onChange={(e) => patch({ playwrightScriptPath: e.target.value })}
                className={inputClass}
                placeholder="tests/auth/login.spec.ts"
                maxLength={500}
                data-testid="case-script-path"
              />
            </Field>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryButton} data-testid="case-save">
          {saving ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri kaydet' : 'Oluştur'}
        </button>
        <Link to="/test-cases" className={secondaryButton}>
          İptal
        </Link>
      </div>
    </form>
  );
}
