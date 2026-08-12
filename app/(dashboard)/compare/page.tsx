"use client";

import { useMemo } from "react";
import Link from "next/link";
import PageShell from "@/app/(dashboard)/components/ui/PageShell";
import ErrorBanner from "@/app/(dashboard)/components/ui/ErrorBanner";
import TrendCard from "@/app/(dashboard)/components/benchmark/TrendCard";
import BenchmarkLeaderboardTable from "@/app/(dashboard)/components/benchmark/BenchmarkLeaderboardTable";
import { PageTableSkeleton } from "../components/Skeleton";
import { useBenchmarkRuns } from "@/app/(dashboard)/hooks/useBenchmarkRuns";
import { computeGroups } from "@/app/(dashboard)/lib/benchmark-trends";
import { formatMs } from "@/app/(dashboard)/lib/format";

export default function ComparePage() {
  const { runs, error, isInitialLoading } = useBenchmarkRuns();

  const groups = useMemo(() => computeGroups(runs), [runs]);
  const completedRuns = useMemo(() => runs.filter((run) => run.status === "completed"), [runs]);
  const bestF1 = useMemo(
    () => (completedRuns.length ? Math.max(...completedRuns.map((run) => run.metrics.tokenF1)) : 0),
    [completedRuns],
  );
  const bestLatency = useMemo(
    () => (completedRuns.length ? Math.min(...completedRuns.map((run) => run.metrics.latencyMs)) : 0),
    [completedRuns],
  );
  const modelCount = useMemo(
    () => new Set(completedRuns.map((run) => `${run.provider}/${run.model}`)).size,
    [completedRuns],
  );
  const datasetCount = useMemo(
    () => new Set(completedRuns.map((run) => run.datasetId)).size,
    [completedRuns],
  );

  if (isInitialLoading) {
    return <PageTableSkeleton />;
  }

  if (error) {
    return (
      <PageShell maxWidth={6}>
        <ErrorBanner message={error} />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth={6} bodyClassName="space-y-8">
      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Benchmark compare</p>
        <h1 className="text-3xl font-bold tracking-tight">Compare pipelines with local benchmark trends.</h1>
        <p className="max-w-3xl text-sm text-muted leading-6">
          This view reads benchmark runs from OPFS only. Use it to compare models, watch token F1 and latency move over time, and spot regressions without any server-side history.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span className="px-3 py-1.5 rounded-full border border-line bg-bg-alt">{completedRuns.length} completed runs</span>
          <span className="px-3 py-1.5 rounded-full border border-line bg-bg-alt">{modelCount} models</span>
          <span className="px-3 py-1.5 rounded-full border border-line bg-bg-alt">{datasetCount} datasets</span>
          <span className="px-3 py-1.5 rounded-full border border-line bg-bg-alt">Best F1 {(bestF1 * 100).toFixed(1)}%</span>
          <span className="px-3 py-1.5 rounded-full border border-line bg-bg-alt">Fastest {bestLatency ? formatMs(bestLatency) : "n/a"}</span>
        </div>
      </section>

      {!completedRuns.length ? (
        <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
          <p className="text-muted">No completed benchmark runs yet.</p>
          <Link href="/benchmarks" className="text-accent text-sm hover:underline mt-2 inline-block">
            Run a benchmark first →
          </Link>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.slice(0, 6).map((group) => (
              <TrendCard
                key={`${group.datasetName}-${group.provider}-${group.model}`}
                group={group}
              />
            ))}
          </section>

          <BenchmarkLeaderboardTable groups={groups} />
        </>
      )}
    </PageShell>
  );
}
