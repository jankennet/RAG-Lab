// Pure benchmark trend/compare logic — React-free. Lifted verbatim from
// app/(dashboard)/compare/page.tsx (L18-71) so it can be shared by the compare
// page, the about overview, and any future ranking view. Behavior unchanged.

import type { BenchmarkRun, BenchmarkMetrics } from "@/client/opfs";
import { formatMs } from "./format";

export type TrendMetric = keyof Pick<
  BenchmarkMetrics,
  "tokenF1" | "faithfulness" | "answerRelevance" | "exactMatch" | "latencyMs"
>;

export type TrendGroup = {
  datasetName: string;
  provider: string;
  model: string;
  runs: BenchmarkRun[];
};

export function formatDelta(value: number, isLatency = false): string {
  const sign = value > 0 ? "+" : "";
  if (isLatency) return `${sign}${formatMs(value)}`;
  return `${sign}${(value * 100).toFixed(1)} pts`;
}

export function metricValue(run: BenchmarkRun, metric: TrendMetric): number {
  return run.metrics[metric] ?? 0;
}

export function sparkline(values: number[]): string {
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

export function computeGroups(runs: BenchmarkRun[]): TrendGroup[] {
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
    .sort(
      (a, b) =>
        b.runs.length - a.runs.length ||
        b.runs[b.runs.length - 1].createdAt - a.runs[a.runs.length - 1].createdAt,
    );
}

export function metricSummary(run: BenchmarkRun): string {
  return `${(run.metrics.tokenF1 * 100).toFixed(1)}% F1 · ${formatMs(run.metrics.latencyMs)} latency`;
}
