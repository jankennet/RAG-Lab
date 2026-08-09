"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { loadBenchmarkRuns } from "@/client/opfs";
import type { BenchmarkRun, BenchmarkMetrics } from "@/client/opfs";

type ModelEntry = {
  datasetName: string;
  provider: string;
  model: string;
  runCount: number;
  metrics: BenchmarkMetrics;
  lastRunAt: number;
  runId: string;
};

type DatasetGroup = {
  datasetName: string;
  models: ModelEntry[];
};

type RankingData = {
  groups: ModelEntry[];
  byDataset: DatasetGroup[];
};

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function Cell({ value, label, best }: { value: number; label: string; best: boolean }) {
  const pct = label === "latency" ? formatMs(value) : `${(value * 100).toFixed(1)}%`;
  const isGood =
    label === "latency"
      ? value < 500
      : value >= 0.7;
  const isOk =
    label === "latency"
      ? value < 2000
      : value >= 0.4;
  const color = best ? "text-accent" : isGood ? "text-success" : isOk ? "text-warning" : "text-danger";
  return (
    <span className={`font-mono text-sm ${color} ${best ? "font-bold" : ""}`}>
      {pct}
      {best && <span className="text-accent ml-1">&#9733;</span>}
    </span>
  );
}

function ModelRow({ entry, isBest }: { entry: ModelEntry; isBest: boolean }) {
  const m = entry.metrics;
  return (
    <tr className="border-b border-line/40 hover:bg-bg-alt/30">
      <td className="py-2.5 px-3">
        <Link href={`/benchmarks/${entry.runId}`} className="font-mono text-sm text-accent hover:underline">
          {entry.provider}/{entry.model}
        </Link>
        <span className="text-xs text-muted ml-2">({entry.runCount}x)</span>
      </td>
      <td className="py-2.5 px-3"><Cell value={m.tokenF1} label="f1" best={isBest} /></td>
      <td className="py-2.5 px-3"><Cell value={m.faithfulness} label="faith" best={isBest} /></td>
      <td className="py-2.5 px-3"><Cell value={m.answerRelevance} label="relv" best={isBest} /></td>
      <td className="py-2.5 px-3"><Cell value={m.exactMatch ?? 0} label="exact" best={isBest} /></td>
      <td className="py-2.5 px-3"><Cell value={m.latencyMs} label="latency" best={isBest} /></td>
    </tr>
  );
}

function computeRanking(runs: BenchmarkRun[]): RankingData {
  const completed = runs.filter((r) => r.status === "completed");

  // Group by datasetName + provider + model
  const groupMap = new Map<string, BenchmarkRun[]>();
  for (const run of completed) {
    const key = `${run.datasetName}::${run.provider}::${run.model}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(run);
  }

  const groups: ModelEntry[] = Array.from(groupMap.entries())
    .map(([key, groupRuns]) => {
      const [datasetName, provider, model] = key.split("::");
      const latest = groupRuns.sort((a, b) => b.createdAt - a.createdAt)[0];
      return {
        datasetName,
        provider,
        model,
        runCount: groupRuns.length,
        metrics: latest.metrics,
        lastRunAt: latest.createdAt,
        runId: latest.id,
      };
    })
    .sort((a, b) => b.metrics.tokenF1 - a.metrics.tokenF1);

  const datasetGroups = new Map<string, ModelEntry[]>();
  for (const g of groups) {
    if (!datasetGroups.has(g.datasetName)) datasetGroups.set(g.datasetName, []);
    datasetGroups.get(g.datasetName)!.push(g);
  }

  const byDataset: DatasetGroup[] = Array.from(datasetGroups.entries())
    .map(([name, entries]) => ({
      datasetName: name,
      models: entries.sort((a, b) => b.metrics.tokenF1 - a.metrics.tokenF1),
    }))
    .sort((a, b) => b.models.length - a.models.length);

  return { groups, byDataset };
}

export { default } from "../compare/page";