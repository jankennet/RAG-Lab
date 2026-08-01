"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Metrics = {
  latencyMs: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
  tokenF1: number;
};

type ModelEntry = {
  datasetName: string;
  provider: string;
  model: string;
  runCount: number;
  metrics: Metrics;
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
      <td className="py-2.5 px-3"><Cell value={m.contextUtilization} label="ctx" best={isBest} /></td>
      <td className="py-2.5 px-3"><Cell value={m.latencyMs} label="latency" best={isBest} /></td>
    </tr>
  );
}

export default function RankingPage() {
  const [data, setData] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/ranking")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load ranking");
        return r.json();
      })
      .then((d: RankingData) => {
        setData(d);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-muted text-center py-12">Loading ranking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.byDataset?.length) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold mb-4">Model Ranking</h1>
          <p className="text-muted text-sm mb-8">
            Compare model performance across benchmarks. Run benchmarks with different models/providers to populate ranking.
          </p>
          <div className="bg-bg-alt border border-line rounded-2xl p-8 text-center">
            <p className="text-muted">No benchmark data yet.</p>
            <Link href="/benchmarks" className="text-accent text-sm hover:underline mt-2 inline-block">
              Run a benchmark first &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2">Model Ranking</h1>
        <p className="text-sm text-muted mb-8">
          Compare LLMs by token F1, faithfulness, relevance, context utilization, and latency.
          &#9733; = best score per dataset.
        </p>

        {data.byDataset.map((group) => (
          <div key={group.datasetName} className="mb-10">
            <h2 className="font-semibold text-lg mb-3">{group.datasetName}</h2>
            <div className="bg-bg-alt border border-line rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line/60 bg-bg/50">
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">Model</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">F1</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">Faith</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">Relev</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">Ctx</th>
                    <th className="text-left py-3 px-3 text-xs text-muted font-semibold uppercase tracking-wider">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {group.models.map((entry, i) => (
                    <ModelRow key={`${entry.provider}-${entry.model}`} entry={entry} isBest={i === 0} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {data.groups?.length ? (
          <div className="mt-8 pt-6 border-t border-line">
            <h2 className="font-semibold mb-2">Summary</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-bg-alt rounded-xl p-4 border border-line">
                <span className="text-xs text-muted block mb-1">Total benchmark runs</span>
                <span className="text-lg font-bold">{data.groups.reduce((s, g) => s + g.runCount, 0)}</span>
              </div>
              <div className="bg-bg-alt rounded-xl p-4 border border-line">
                <span className="text-xs text-muted block mb-1">Models compared</span>
                <span className="text-lg font-bold">{data.groups.length}</span>
              </div>
              <div className="bg-bg-alt rounded-xl p-4 border border-line">
                <span className="text-xs text-muted block mb-1">Datasets</span>
                <span className="text-lg font-bold">{data.byDataset.length}</span>
              </div>
              <div className="bg-bg-alt rounded-xl p-4 border border-line">
                <span className="text-xs text-muted block mb-1">Best F1 overall</span>
                <span className="text-lg font-bold text-accent">
                  {`${(Math.max(...data.groups.map((g) => g.metrics.tokenF1)) * 100).toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}