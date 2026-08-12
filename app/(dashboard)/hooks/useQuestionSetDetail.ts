// Question-set detail state: loads a set's meta + its questions from OPFS,
// and exposes `remove` for the detail page's Delete button.
//
// Lifted from benchmark-datasets/[id]/page.tsx L19-58. Two parity notes:
// 1. The original load fallback string was "Failed to load question set"
//    (L30), not useAsync's generic "Failed to load data" — the fetcher remaps
//    so the exposed message stays identical (same trick useDatasetDetail uses).
// 2. The original Delete handler set the SAME error state load used, so a
//    delete failure flipped the page into the error banner (hiding the loaded
//    detail). To preserve that single-error union, delete failures land in a
//    `deleteError` overlay that ORs with the load error — so the page's
//    `if (error || !set)` branch still triggers on a failed delete exactly as
//    before. `remove` returns success so the page navigates only on success.

"use client";

import { useCallback, useState } from "react";
import { loadQuestionSetMeta, loadQuestions, deleteQuestionSet } from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet, BenchmarkQuestion } from "@/client/benchmark-questions";
import { useAsync } from "./useAsync";

type QuestionSetDetail = {
  set: BenchmarkQuestionSet | null;
  questions: BenchmarkQuestion[];
};

const INITIAL: QuestionSetDetail = { set: null, questions: [] };

export function useQuestionSetDetail(id: string) {
  const { data, error: loadError, isInitialLoading, refetch } = useAsync<QuestionSetDetail>(
    async () => {
      try {
        const [meta, qs] = await Promise.all([loadQuestionSetMeta(id), loadQuestions(id)]);
        return { set: meta, questions: qs };
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to load question set");
      }
    },
    INITIAL,
    [id],
  );

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = useCallback(async (): Promise<boolean> => {
    try {
      await deleteQuestionSet(id);
      return true;
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
      return false;
    }
  }, [id]);

  const error = loadError || deleteError;

  return {
    set: data.set,
    questions: data.questions,
    error,
    isInitialLoading,
    refetch,
    remove,
  };
}
