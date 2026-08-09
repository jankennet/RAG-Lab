"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadBenchmarkRuns } from "@/client/opfs";
import type { BenchmarkRun, BenchmarkMetrics } from "@/client/opfs";

type TrendMetric = keyof Pick<BenchmarkMetrics, "tokenF1" | "faithfulness" | "answerRelevance" | "exactMatch" | "latencyMs">;

type TrendGroup = {
  datasetName: string;
  provider: string;
  model: string;
  runs: BenchmarkRun[];
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatDelta(value: number, isLatency = false): string {
  const sign = value > 0 ? "+" : "";
  if (isLatency) return `${sign}${formatMs(value)}`;
  return `${sign}${(value * 100).toFixed(1)} pts`;
}

function metricValue(run: BenchmarkRun, metric: TrendMetric): number {
  return run.metrics[metric] ?? 0;
}

function sparkline(values: number[]): string {
  if (values.length <= 1) return "0,18 100,18";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 36 - ((value - min) / span) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function computeGroups(runs: BenchmarkRun[]): TrendGroup[] {
  const completed = runs.filter((run) => run.status === "completed");
  const map = new Map<string, BenchmarkRun[]>();

  for (const run of completed) {
    const key = `${run.datasetName}::${run.provider}::${run.model}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(run);
  }

  return Array.from(map.entries())
    .map(([key, groupRuns]) => {
      const [datasetName, provider, model] = key.split("::");
      return {
        datasetName,
        provider,
        model,
        runs: groupRuns.sort((a, b) => a.createdAt - b.createdAt),
      };
    })
    .sort((a, b) => b.runs.length - a.runs.length || b.runs[b.runs.length - 1].createdAt - a.runs[a.runs.length - 1].createdAt);
}

function metricSummary(run: BenchmarkRun): string {
  return `${(run.metrics.tokenF1 * 100).toFixed(1)}% F1 · ${formatMs(run.metrics.latencyMs)} latency`;
}

export default function ComparePage() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    loadBenchmarkRuns()
      .then((data) => {
        setRuns(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load benchmark runs"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => computeGroups(runs), [runs]);
  const completedRuns = runs.filter((run) => run.status === "completed");
  const bestF1 = completedRuns.length ? Math.max(...completedRuns.map((run) => run.metrics.tokenF1)) : 0;
  const bestLatency = completedRuns.length ? Math.min(...completedRuns.map((run) => run.metrics.latencyMs)) : 0;
  const modelCount = new Set(completedRuns.map((run) => `${run.provider}/${run.model}`)).size;
  const datasetCount = new Set(completedRuns.map((run) => run.datasetId)).size;

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-muted text-center py-12">Loading compare view...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
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
              {groups.slice(0, 6).map((group) => {
                const latest = group.runs[group.runs.length - 1];
                const previous = group.runs[group.runs.length - 2];
                const tokenF1Delta = previous ? latest.metrics.tokenF1 - previous.metrics.tokenF1 : 0;
                const latencyDelta = previous ? latest.metrics.latencyMs - previous.metrics.latencyMs : 0;
                const f1Values = group.runs.map((run) => metricValue(run, "tokenF1"));
                const latencyValues = group.runs.map((run) => metricValue(run, "latencyMs"));

                return (
                  <article key={`${group.datasetName}-${group.provider}-${group.model}`} className="bg-bg-alt border border-line rounded-2xl p-5 space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted uppercase tracking-wider">{group.datasetName}</p>
                      <h2 className="font-semibold text-text">{group.provider}/{group.model}</h2>
                      <p className="text-xs text-muted">Latest run {new Date(latest.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-line bg-bg/50 p-3">
                        <p className="text-xs text-muted mb-1">Token F1</p>
                        <p className="font-mono text-base text-text">{(latest.metrics.tokenF1 * 100).toFixed(1)}%</p>
                        <p className={`text-xs mt-1 ${tokenF1Delta >= 0 ? "text-success" : "text-danger"}`}>{previous ? formatDelta(tokenF1Delta) : "No prior run"}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-bg/50 p-3">
                        <p className="text-xs text-muted mb-1">Latency</p>
                        <p className="font-mono text-base text-text">{formatMs(latest.metrics.latencyMs)}</p>
                        <p className={`text-xs mt-1 ${latencyDelta <= 0 ? "text-success" : "text-danger"}`}>{previous ? formatDelta(latencyDelta, true) : "No prior run"}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted mb-1">
                          <span>Token F1 trend</span>
                          <span>{metricSummary(latest)}</span>
                        </div>
                        <svg viewBox="0 0 100 36" className="w-full h-10 overflow-visible">
                          <polyline points={sparkline(f1Values)} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted mb-1">
                          <span>Latency trend</span>
                          <span>{group.runs.length} runs</span>
                        </div>
                        <svg viewBox="0 0 100 36" className="w-full h-10 overflow-visible">
                          <polyline points={sparkline(latencyValues)} fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-strong" />
                        </svg>
                      </div>
                    </div>

                    <Link href={`/benchmarks/${latest.id}`} className="text-xs text-accent hover:underline inline-block">
                      Open latest run →
                    </Link>
                  </article>
                );
              })}
            </section>

            <section className="bg-bg-alt border border-line rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-line">
                <h2 className="font-semibold">Leaderboard</h2>
                <p className="text-sm text-muted mt-1">Latest completed run per dataset/model, sorted by best token F1.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line/60 bg-bg/50">
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Model</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Dataset</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Token F1</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Faithfulness</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Relevance</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Ctx util</th>
                      <th className="text-left py-3 px-4 text-xs text-muted font-semibold uppercase tracking-wider">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const latest = group.runs[group.runs.length - 1];
                      return (
                        <tr key={`${group.datasetName}-${group.provider}-${group.model}`} className="border-b border-line/40 hover:bg-bg/40">
                          <td className="py-3 px-4 font-mono text-accent">{group.provider}/{group.model}</td>
                          <td className="py-3 px-4 text-muted">{group.datasetName}</td>
                          <td className="py-3 px-4">{(latest.metrics.tokenF1 * 100).toFixed(1)}%</td>
                          <td className="py-3 px-4">{(latest.metrics.faithfulness * 100).toFixed(1)}%</td>
                          <td className="py-3 px-4">{(latest.metrics.answerRelevance * 100).toFixed(1)}%</td>
                          <td className="py-3 px-4">{((latest.metrics.exactMatch ?? 0) * 100).toFixed(1)}%</td>
                          <td className="py-3 px-4">{formatMs(latest.metrics.latencyMs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}