"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadQuestionSetMeta, loadQuestions, deleteQuestionSet } from "@/client/benchmark-questions";
import type { BenchmarkQuestionSet, BenchmarkQuestion } from "@/client/benchmark-questions";
import { PageDetailSkeleton } from "../../components/Skeleton";

export default function BenchmarkDatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [set, setSet] = useState<BenchmarkQuestionSet | null>(null);
  const [questions, setQuestions] = useState<BenchmarkQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meta, qs] = await Promise.all([
        loadQuestionSetMeta(id),
        loadQuestions(id),
      ]);
      setSet(meta);
      setQuestions(qs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load question set");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Extract unique categories
  const categories = Array.from(new Set(questions.map((q) => q.category).filter(Boolean) as string[])).sort();

  // Filter questions
  const filtered = questions.filter((q) => {
    if (search && !q.question.toLowerCase().includes(search.toLowerCase()) && !q.groundTruth.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory && q.category !== selectedCategory) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!confirm("Delete this question set?")) return;
    try {
      await deleteQuestionSet(id);
      router.push("/benchmarks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) {
    return <PageDetailSkeleton />;
  }

  if (error || !set) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger text-sm">{error || "Question set not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">{set.name}</h1>
            <p className="text-sm text-muted">
              {set.questionCount} questions · {set.source}
              {set.sourceUrl && (
                <span className="ml-2">
                  · <a href={set.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">source</a>
                </span>
              )}
            </p>
            <p className="text-xs text-muted mt-1">
              Created {new Date(set.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="text-sm text-muted hover:text-danger transition-colors px-3 py-1.5 border border-line rounded-xl"
          >
            Delete
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="flex-1 px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
          />
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Question list */}
        {filtered.length === 0 ? (
          <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
            <p className="text-muted text-sm">
              {search || selectedCategory
                ? "No questions match your filters."
                : "No questions in this set."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted mb-2">
              Showing {filtered.length} of {questions.length} questions
            </p>
            {filtered.map((q, i) => (
              <div
                key={q.id}
                className="bg-bg-alt border border-line rounded-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-line/50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-text leading-relaxed">
                      <span className="text-muted font-mono mr-2">Q{i + 1}.</span>
                      {q.question}
                    </p>
                    {q.category && (
                      <span className="text-xs text-muted bg-bg px-2 py-0.5 rounded-full border border-line whitespace-nowrap shrink-0">
                        {q.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3 bg-bg/40">
                  <span className="text-xs text-muted block mb-1">Ground Truth:</span>
                  <p className="text-sm text-text leading-relaxed">{q.groundTruth}</p>
                </div>
                {q.difficulty && (
                  <div className="px-4 py-2 border-t border-line/30 flex items-center gap-2">
                    <span className="text-xs text-muted">Difficulty:</span>
                    <span className="text-xs font-medium text-text">{q.difficulty}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}