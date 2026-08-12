// Question-set list state: loads the OPFS index of benchmark question sets
// and surfaces the load error (the page historically did NOT swallow it —
// benchmark-datasets/page L33 set the banner, unlike datasets/page which
// swallowed). No delete here: the list page has no per-row delete; delete
// lives on the detail page via useQuestionSetDetail.remove.

"use client";

import { loadQuestionSets } from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";
import { useAsync } from "./useAsync";

export function useQuestionSets() {
  const { data: questionSets, error, isInitialLoading, refetch } = useAsync<BenchmarkQuestionSet[]>(
    async () => {
      try {
        return await loadQuestionSets();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to load question sets");
      }
    },
    [],
  );

  return { questionSets, error, isInitialLoading, refetch };
}
