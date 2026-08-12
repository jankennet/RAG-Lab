// Top-level data fetch for the benchmarks list page: benchmark runs, KB
// datasets (for the run-form select), and question sets (for the run-form select
// + the list section), all loaded in one Promise.all. Lifted from
// benchmarks/page.tsx fetchData (L63-80). The page renders off these + hands the
// datasets/questionSets to the runner hook + form components.

"use client";

import type { OpfsDataset, BenchmarkRun } from "@/client/opfs";
import { loadBenchmarkRuns, loadIndex } from "@/client/opfs";
import { loadQuestionSets } from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet } from "@/client/benchmark-questions";
import { useAsync } from "./useAsync";

type BenchmarksData = {
  runs: BenchmarkRun[];
  datasets: OpfsDataset[];
  questionSets: BenchmarkQuestionSet[];
};

const INITIAL: BenchmarksData = { runs: [], datasets: [], questionSets: [] };

export function useBenchmarksData() {
  const { data, loading, isInitialLoading, error, refetch } = useAsync<BenchmarksData>(
    async () => {
      const [runs, index, qSets] = await Promise.all([
        loadBenchmarkRuns(),
        loadIndex(),
        loadQuestionSets(),
      ]);
      return { runs, datasets: index, questionSets: qSets };
    },
    INITIAL,
    [],
  );

  return {
    runs: data.runs,
    datasets: data.datasets,
    questionSets: data.questionSets,
    loading,
    isInitialLoading,
    error,
    refetch,
  };
}
