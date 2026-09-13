import { useState } from 'react';
import { inputClass, secondaryButton } from './ui.js';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  /** true ise ↑↓ ile sıra değiştirilebilir (adımlar için). */
  ordered?: boolean;
  testId: string;
}

/** Adımlar ve etiketler için ekle / sil / (opsiyonel) sırala girdisi. */
export function StringListInput({ value, onChange, placeholder, ordered, testId }: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item as string);
    onChange(next);
  };

  return (
    <div data-testid={testId}>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map((item, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: liste sıralı ve içerik tekrar edebilir
              key={`${item}-${index}`}
              className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm"
            >
              {ordered && <span className="w-5 text-xs text-slate-400">{index + 1}.</span>}
              <span className="flex-1 break-words text-slate-800">{item}</span>
              {ordered && (
                <>
                  <button
                    type="button"
                    aria-label="Yukarı taşı"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Aşağı taşı"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    className="px-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Kaldır"
                onClick={() => removeAt(index)}
                className="px-1 text-slate-400 hover:text-rose-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
          data-testid={`${testId}-input`}
        />
        <button type="button" onClick={add} className={secondaryButton}>
          Ekle
        </button>
      </div>
    </div>
  );
}
