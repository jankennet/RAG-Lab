"use client";

import { useParams } from "next/navigation";
import { PageDetailSkeleton } from "../../components/Skeleton";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import MetricCard from "@/app/(dashboard)/components/benchmark/MetricCard";
import AnswerStatusBreakdown from "@/app/(dashboard)/components/benchmark/AnswerStatusBreakdown";
import PerQuestionBreakdown from "@/app/(dashboard)/components/benchmark/PerQuestionBreakdown";
import { useBenchmarkRun } from "@/app/(dashboard)/hooks/useBenchmarkRun";
import { METRICS } from "@/app/(dashboard)/lib/benchmark-metrics";

export default function BenchmarkDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { run, isInitialLoading, error } = useBenchmarkRun(id);

  if (isInitialLoading && !run) {
    return <PageDetailSkeleton />;
  }

  if (error || !run) {
    return (
      <PageShell maxWidth={3}>
        <ErrorBanner message={error || "Run not found"} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={3}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">{run.datasetName}</h1>
        <p className="text-sm text-muted">
          {new Date(run.createdAt).toLocaleString()} &middot; {run.totalQuestions} questions
        </p>
        <p className="text-xs text-muted mt-1 font-mono">
          {run.provider}/{run.model}
        </p>

        <AnswerStatusBreakdown run={run} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
        {METRICS.map((m) => {
          const val = run.metrics[m.key] ?? 0;
          return <MetricCard key={m.key} metric={m} value={val} />;
        })}
      </div>

      {/* Per-question breakdown */}
      <PerQuestionBreakdown details={run.details} />
    </PageShell>
  );
}
