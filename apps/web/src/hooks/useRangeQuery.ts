import { useEffect, useRef, useState } from 'react';

interface RangeQueryOptions {
  url: string;
  deps: unknown[];
}

export function useRangeQuery<T = ArrayBuffer>({
  url,
  deps,
}: RangeQueryOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);

    fetch(url, { signal: ctrl.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        setData(buffer as unknown as T);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          return;
        }
        setError(
          caught instanceof Error ? caught : new Error(String(caught)),
        );
        setLoading(false);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { data, loading, error };
}
