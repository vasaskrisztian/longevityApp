'use client';

import { useCallback, useEffect, useState } from 'react';

/** Small data hook: runs `load` on mount and whenever `reload()` is called. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    stableLoad()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load.');
      });
    return () => {
      cancelled = true;
    };
  }, [stableLoad, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload };
}
