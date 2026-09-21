import type { ReactNode } from 'react';
import {
  STEP_ACTIONS,
  STEP_ACTION_LABELS,
  type ResultStatus,
  type ScenarioElement,
  type ScenarioStepInput,
  type StepAction,
  type StepResult,
} from '../api/types.js';
import { inputClass, secondaryButton } from './ui.js';

/**
 * Adım satırındaki alanlar yan yana durur; `inputClass` içindeki `w-full` genişlik
 * sınıflarıyla çakıştığı için burada çıkarılır.
 */
const cellClass = inputClass.replace('w-full ', '');

const STATUS_STYLES: Record<ResultStatus, string> = {
  PASS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  FAIL: 'bg-rose-50 text-rose-700 ring-rose-200',
  BLOCKED: 'bg-amber-50 text-amber-800 ring-amber-200',
  SKIPPED: 'bg-slate-100 text-slate-600 ring-slate-200',
  NOT_RUN: 'bg-slate-50 text-slate-500 ring-slate-200',
};

const STATUS_LABELS: Record<ResultStatus, string> = {
  PASS: 'Geçti',
  FAIL: 'Başarısız',
  BLOCKED: 'Engellendi',
  SKIPPED: 'Atlandı',
  NOT_RUN: 'Çalışmadı',
};

export function StatusChip({ status }: { status: ResultStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Hangi adım tipinin hedef elemente / değere ihtiyacı var? */
export const needsTarget = (action: StepAction): boolean =>
  ['CLICK', 'TYPE', 'SELECT', 'ASSERT_VISIBLE', 'ASSERT_NOT_VISIBLE', 'ASSERT_VALUE'].includes(
    action,
  );

export const needsValue = (action: StepAction): boolean =>
  ['GOTO', 'TYPE', 'SELECT', 'ASSERT_TEXT', 'ASSERT_URL', 'ASSERT_VALUE'].includes(action);

const VALUE_PLACEHOLDERS: Partial<Record<StepAction, string>> = {
  GOTO: 'https://ornek.com/giris',
  TYPE: 'test@ornek.com veya {{sifre}}',
  SELECT: 'secenek-degeri',
  ASSERT_TEXT: 'Hoş geldiniz',
  ASSERT_URL: '/panel',
  ASSERT_VALUE: 'beklenen değer',
};

/** WAIT adımının üç biçimi alan doluluğundan okunur (backend ile aynı kural). */
type WaitKind = 'duration' | 'url' | 'element';
const waitKindOf = (step: ScenarioStepInput): WaitKind =>
  step.targetElementId ? 'element' : step.value ? 'url' : 'duration';

export function StepEditor({
  steps,
  elements,
  onChange,
}: {
  steps: ScenarioStepInput[];
  elements: ScenarioElement[];
  onChange: (steps: ScenarioStepInput[]) => void;
}) {
  const update = (index: number, patch: Partial<ScenarioStepInput>) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next);
  };

  const changeAction = (index: number, action: StepAction) => {
    // Tip değişince anlamını yitiren alanlar temizlenir.
    update(index, {
      action,
      targetElementId: needsTarget(action) ? steps[index]?.targetElementId ?? null : null,
      value: needsValue(action) ? steps[index]?.value ?? '' : null,
      timeoutMs: action === 'WAIT' ? (steps[index]?.timeoutMs ?? 1000) : null,
    });
  };

  const changeWaitKind = (index: number, kind: WaitKind) => {
    update(index, {
      targetElementId: kind === 'element' ? (elements[0]?.id ?? null) : null,
      value: kind === 'url' ? '' : null,
      timeoutMs: kind === 'duration' ? 1000 : null,
    });
  };

  if (steps.length === 0) {
    return <p className="text-sm text-slate-500">Henüz adım yok. Aşağıdan ilk adımı ekleyin.</p>;
  }

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => {
        const waitKind = step.action === 'WAIT' ? waitKindOf(step) : null;
        const showTarget = needsTarget(step.action) || waitKind === 'element';
        const showValue = needsValue(step.action) || waitKind === 'url';

        return (
          <li
            key={index}
            className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span className="w-6 text-xs text-slate-400">{index + 1}</span>

            <select
              value={step.action}
              onChange={(e) => changeAction(index, e.target.value as StepAction)}
              className={`${cellClass} w-44`}
              aria-label={`Adım ${index + 1} tipi`}
            >
              {STEP_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {STEP_ACTION_LABELS[action]}
                </option>
              ))}
            </select>

            {waitKind && (
              <select
                value={waitKind}
                onChange={(e) => changeWaitKind(index, e.target.value as WaitKind)}
                className={`${cellClass} w-36`}
                aria-label={`Adım ${index + 1} bekleme türü`}
              >
                <option value="duration">süre (ms)</option>
                <option value="url">URL içerene kadar</option>
                <option value="element">element görünene kadar</option>
              </select>
            )}

            {showTarget && (
              <select
                value={step.targetElementId ?? ''}
                onChange={(e) => update(index, { targetElementId: e.target.value || null })}
                className={`${cellClass} min-w-44 flex-1`}
                aria-label={`Adım ${index + 1} hedefi`}
              >
                <option value="">— element seçin —</option>
                {elements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label} ({el.role})
                  </option>
                ))}
              </select>
            )}

            {showValue && (
              <input
                type="text"
                value={step.value ?? ''}
                onChange={(e) => update(index, { value: e.target.value })}
                placeholder={VALUE_PLACEHOLDERS[step.action] ?? 'değer'}
                className={`${cellClass} min-w-44 flex-1`}
                aria-label={`Adım ${index + 1} değeri`}
              />
            )}

            {step.action === 'WAIT' && waitKind === 'duration' && (
              <input
                type="number"
                min={0}
                value={step.timeoutMs ?? 0}
                onChange={(e) => update(index, { timeoutMs: Number(e.target.value) })}
                className={`${cellClass} w-28`}
                aria-label={`Adım ${index + 1} süresi (ms)`}
              />
            )}

            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                className={`${secondaryButton} px-2 py-1`}
                aria-label="Yukarı taşı"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                className={`${secondaryButton} px-2 py-1`}
                aria-label="Aşağı taşı"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => onChange(steps.filter((_, i) => i !== index))}
                className={`${secondaryButton} px-2 py-1 text-rose-700`}
                aria-label="Adımı sil"
              >
                ✕
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Çalıştırma raporu: adım adım sonuç, seçici kayması uyarısı ve ekran görüntüsü. */
export function RunReport({
  steps,
  resolveUpload,
}: {
  steps: StepResult[];
  resolveUpload: (url: string | null) => string | null;
}) {
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const shot = resolveUpload(step.screenshotUrl);
        return (
          <li key={step.id} className="rounded-md border border-slate-200 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-xs text-slate-400">{step.order + 1}</span>
              <StatusChip status={step.status} />
              <code className="text-xs text-slate-700">{step.description}</code>
              <span className="ml-auto text-xs text-slate-400">{step.durationMs} ms</span>
            </div>

            {step.selectorDrift && (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Seçici kayması: ilk aday tutmadı, {(step.usedSelectorIndex ?? 0) + 1}. aday ile
                bulundu. Sayfa değişmiş olabilir.
              </p>
            )}

            {step.error && (
              <p className="mt-1 whitespace-pre-wrap rounded bg-rose-50 px-2 py-1 text-xs text-rose-800">
                {step.error}
              </p>
            )}

            {shot && (
              <a href={shot} target="_blank" rel="noreferrer" className="mt-2 block">
                <img
                  src={shot}
                  alt="Hata anındaki ekran görüntüsü"
                  className="max-h-64 rounded border border-slate-200"
                />
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
