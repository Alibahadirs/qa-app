import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Basit veri çekme hook'u: `deps` değiştiğinde `fn`'i çağırır, sonucu tutar.
 * `reload` mutasyon sonrası listeyi tazelemek için kullanılır.
 * Eski isteklerin geç dönen yanıtları yok sayılır (race koruması).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & {
  reload: () => void;
  setData: (data: T) => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    fnRef
      .current()
      .then((data) => {
        if (id === requestId.current) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (id === requestId.current) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Bilinmeyen hata',
          });
        }
      });
    // fn kasıtlı olarak bağımlılık değil; çağıran deps listesini yönetir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ data, loading: false, error: null }), []);

  return { ...state, reload, setData };
}
