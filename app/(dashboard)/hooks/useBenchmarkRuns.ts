// Benchmark-runs list state: loads every OPFS benchmark run via useAsync. This
// is the raw list only — derived views (completedRuns, best F1, best latency,
// model/dataset counts, computeGroups) stay as `useMemo` in the compare page
// (they're view-specific) and are NOT duplicated here. About composes this hook
// via `useOverviewStats`.
//
// The original compare effect (L78-87) set a generic error string
// "Failed to load benchmark runs" on failure — the fetcher remap preserves
// that exact message rather than useAsync's default "Failed to load data".

"use client";

import { loadBenchmarkRuns } from "@/client/opfs";
import type { BenchmarkRun } from "@/client/opfs";
import { useAsync } from "./useAsync";

export function useBenchmarkRuns() {
  const { data: runs, error, loading, isInitialLoading, refetch } = useAsync<BenchmarkRun[]>(
    async () => {
      try {
        return await loadBenchmarkRuns();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to load benchmark runs");
      }
    },
    [],
  );

  return { runs, error, loading, isInitialLoading, refetch };
}
