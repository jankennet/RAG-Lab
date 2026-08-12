"use client";

import { useParams, useRouter } from "next/navigation";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import QuestionRow from "@/app/(dashboard)/components/benchmark-datasets/QuestionRow";
import { PageDetailSkeleton } from "../../components/Skeleton";
import { useQuestionSetDetail } from "@/app/(dashboard)/hooks/useQuestionSetDetail";
import { useQuestionFilters } from "@/app/(dashboard)/hooks/useQuestionFilters";

export default function BenchmarkDatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { set, questions, error, isInitialLoading, remove } = useQuestionSetDetail(id);
  const { search, setSearch, selectedCategory, setSelectedCategory, categories, filtered } =
    useQuestionFilters(questions);

  const handleDelete = async () => {
    if (!confirm("Delete this question set?")) return;
    const ok = await remove();
    if (ok) router.push("/benchmarks");
  };

  if (isInitialLoading && !set) {
    return <PageDetailSkeleton />;
  }

  if (error || !set) {
    return (
      <PageShell maxWidth={3}>
        <ErrorBanner message={error || "Question set not found"} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={3}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">{set.name}</h1>
          <p className="text-sm text-muted">
            {set.questionCount} questions · {set.source}
            {set.sourceUrl && (
              <span className="ml-2">
                ·{" "}
                <a
                  href={set.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  source
                </a>
              </span>
            )}
          </p>
          <p className="text-xs text-muted mt-1">Created {new Date(set.createdAt).toLocaleString()}</p>
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
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Question list */}
      {filtered.length === 0 ? (
        <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
          <p className="text-muted text-sm">
            {search || selectedCategory ? "No questions match your filters." : "No questions in this set."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted mb-2">
            Showing {filtered.length} of {questions.length} questions
          </p>
          {filtered.map((q, i) => (
            <QuestionRow key={q.id} q={q} idx={i} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
