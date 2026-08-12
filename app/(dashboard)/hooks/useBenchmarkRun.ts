// Single benchmark run fetch for the detail page. Lifted from
// benchmarks/[id]/page.tsx L174-192. The page's effect mapped "not found"
// (loadBenchmarkRun → null) onto a thrown Error("Benchmark not found") and then
// caught it into `error` — this hook preserves that: a null result surfaces as
// the message "Benchmark not found" in `error` (matching the original UI), with
// null `run` so the page renders the not-found branch exactly as before.

"use client";

import type { BenchmarkRun } from "@/client/opfs";
import { loadBenchmarkRun } from "@/client/opfs";
import { useAsync } from "./useAsync";

export function useBenchmarkRun(id: string | undefined) {
  const { data, loading, isInitialLoading, error } = useAsync<BenchmarkRun | null>(
    async () => {
      if (!id) return null;
      const data = await loadBenchmarkRun(id);
      if (!data) throw new Error("Benchmark not found");
      return data;
    },
    null,
    [id],
  );

  return { run: data, loading, isInitialLoading, error };
}
