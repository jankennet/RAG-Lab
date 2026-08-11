// Generic async-resource hook. Replaces the ~6 copies of the
//   setLoading(true); setError(null); try {...} catch { err.message ?? fallback }
//   finally { setLoading(false) }
// pattern across benchmark-datasets (list + detail), datasets (list + detail),
// benchmarks, compare, and about.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncResource<T> = {
  data: T;
  error: string | null;
  loading: boolean;
  /** True only on the first load before any data is present. Used for the
   *  "show skeleton, keep content on refetch" policy several pages wanted. */
  isInitialLoading: boolean;
  refetch: () => Promise<void>;
};

export function useAsync<T>(
  fetcher: () => Promise<T>,
  initialValue: T,
  deps: ReadonlyArray<unknown> = [],
): AsyncResource<T> {
  const [data, setData] = useState<T>(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the latest fetcher so the effect closure sees fresh dependencies
  // without re-subscribing on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // True only while loading AND we've never received data yet. Apply per-type:
  // arrays → empty, nullables → null, scalars fall back to === initialValue.
  const hasNoData = Array.isArray(data)
    ? (data as unknown[]).length === 0
    : data === null || data === undefined || data === initialValue;
  const isInitialLoading = loading && hasNoData;

  return { data, error, loading, isInitialLoading, refetch };
}
