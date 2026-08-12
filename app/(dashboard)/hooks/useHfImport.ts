// Benchmark-datasets-page binding of the shared HuggingFace import flow.
// Phase 4 collapsed the identical `/api/benchmark-datasets` → createQuestionSet
// → saveQuestions handlers from both benchmarks/page and benchmark-datasets/page
// into `useDatasetImport`; this is the thin domain alias the benchmark-datasets
// page composes, so the page reads `useHfImport` (its concern) rather than the
// benchmarks-named hook. The persist pipeline is byte-identical to the pre-refactor
// benchmark-datasets/page handler (L43-93) — no behavior change.

"use client";

import { useDatasetImport } from "./useDatasetImport";

export function useHfImport(options?: { onImported?: () => void }) {
  return useDatasetImport(options);
}
