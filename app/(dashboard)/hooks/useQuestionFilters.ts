// Client-side question filtering for the benchmark-datasets detail page:
// search (matches question OR ground-truth, case-insensitive) + category
// select. Lifted verbatim from benchmark-datasets/[id]/page.tsx L40-48.
// `categories` is the deduped sorted list of non-empty categories, gated by
// the page so the select only renders when there's >0.

"use client";

import { useMemo, useState } from "react";
import type { BenchmarkQuestion } from "@/client/benchmark-questions";

export function useQuestionFilters(questions: BenchmarkQuestion[]) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const categories = useMemo(
    () =>
      Array.from(
        new Set(questions.map((q) => q.category).filter(Boolean) as string[]),
      ).sort(),
    [questions],
  );

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (
        search &&
        !q.question.toLowerCase().includes(search.toLowerCase()) &&
        !q.groundTruth.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (selectedCategory && q.category !== selectedCategory) return false;
      return true;
    });
  }, [questions, search, selectedCategory]);

  return {
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    categories,
    filtered,
  };
}
