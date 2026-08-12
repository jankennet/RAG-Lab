// About-page overview counts: OPFS dataset count + total chunk count +
// completed benchmark-run count. Composes `useBenchmarkRuns` (runs) with a
// `loadIndex` fetch (datasets) and derives the three counts.
//
// Parity wrt the pre-refactor about/page.tsx (L11-40): the original ran a
// single `Promise.all([loadIndex(), loadBenchmarkRuns()])` and SWALLOWED any
// rejection — on failure it set all three counts to 0 and showed the
// skeletons only while loading (no error banner; about has no error UI).
// This hook preserves that swallow: it does NOT expose `error`. useAsync keeps
// the initial `[]` on rejection, so `datasets.length` / `chunkCount` /
// `runs.filter(...).length` all fall back to 0 exactly as the original's
// catch block did. `loading` is true until BOTH fetches settle, matching the
// original's single-Promise.finally gate. formatCount stays in the page (view
// layer); this hook returns raw counts.

"use client";

import { useMemo } from "react";
import { loadIndex } from "@/client/opfs";
import type { OpfsDataset } from "@/client/opfs";
import { useAsync } from "./useAsync";
import { useBenchmarkRuns } from "./useBenchmarkRuns";

export function useOverviewStats() {
  const runsRes = useBenchmarkRuns();
  const datasetsRes = useAsync<OpfsDataset[]>(() => loadIndex(), []);

  const datasetCount = datasetsRes.data.length;
  const chunkCount = useMemo(
    () => datasetsRes.data.reduce((sum, dataset) => sum + dataset.chunkCount, 0),
    [datasetsRes.data],
  );
  const completedRuns = useMemo(
    () => runsRes.runs.filter((run) => run.status === "completed").length,
    [runsRes.runs],
  );

  const loading = runsRes.loading || datasetsRes.loading;

  return { datasetCount, chunkCount, completedRuns, loading };
}
