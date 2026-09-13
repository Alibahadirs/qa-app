import { type FormEvent, useState } from 'react';
import { api } from '../api/client.js';
import { Alert, Field, inputClass, primaryButton } from '../components/ui.js';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <form
        onSubmit={(e) => void submit(e)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h1 className="text-lg font-semibold text-slate-900">QA App</h1>
          <p className="text-sm text-slate-500">Devam etmek için takım parolasını girin.</p>
        </div>

        {error && <Alert>{error}</Alert>}

        <Field label="Parola">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
            autoFocus
            data-testid="login-password"
          />
        </Field>

        <button
          type="submit"
          disabled={busy || !password}
          className={`${primaryButton} w-full`}
          data-testid="login-submit"
        >
          {busy ? 'Kontrol ediliyor…' : 'Giriş yap'}
        </button>
      </form>
    </div>
  );
}
