"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { loadIndex, loadDocuments } from "@/client/opfs";
import type { OpfsDataset } from "@/client/opfs";
import { useDashboard } from "../components/DashboardProvider";

type BenchmarkMetrics = {
  recallAtK: number;
  precisionAtK: number;
  hitRateAtK: number;
  faithfulness: number;
  answerRelevance: number;
  contextUtilization: number;
};

type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  totalQuestions: number;
  metrics: BenchmarkMetrics;
  status: string;
  createdAt: number;
};

function ScoreBadge({ score }: { score: number }) {
  const pct = (score * 100).toFixed(1);
  const color =
    score >= 0.7 ? "text-success" :
    score >= 0.4 ? "text-warning" :
    "text-danger";
  return <span className={`font-mono text-xs font-medium ${color}`}>{pct}%</span>;
}

export default function BenchmarksPage() {
  const { preferences } = useDashboard();
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [datasets, setDatasets] = useState<OpfsDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datasetId, setDatasetId] = useState("");
  const [limit, setLimit] = useState(10);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  // ── Running animation ──
  const RUN_PHASES = [
    "Loading documents from OPFS...",
    "Scoring retrieval relevance...",
    "Evaluating generation quality with LLM...",
    "Checking faithfulness against context...",
    "Analyzing answer relevance...",
    "Measuring context utilization...",
    "Crunching final metrics...",
  ];
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const phaseInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!triggering) {
      if (phaseInterval.current) clearInterval(phaseInterval.current);
      phaseInterval.current = null;
      return;
    }
    setPhaseIdx(0);
    setProgress(0);

    // advance phase every ~2s
    phaseInterval.current = setInterval(() => {
      setPhaseIdx((p) => {
        if (p >= RUN_PHASES.length - 1) {
          // keep cycling last few phases
          return Math.max(RUN_PHASES.length - 3, p);
        }
        return p + 1;
      });
      setProgress((p) => Math.min(p + 0.12, 0.9));
    }, 2200);

    return () => {
      if (phaseInterval.current) clearInterval(phaseInterval.current);
    };
  }, [triggering, RUN_PHASES.length]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, index] = await Promise.all([
        fetch("/api/benchmarks"),
        loadIndex(),
      ]);

      if (!runsRes.ok) throw new Error("Benchmarks fetch failed");

      const runsData = await runsRes.json();
      setRuns(runsData.benchmarks ?? []);
      setDatasets(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datasetId) return;

    setTriggering(true);
    setTriggerError(null);
    try {
      const dataset = datasets.find((d) => d.id === datasetId);
      const docs = await loadDocuments(datasetId);

      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId,
          datasetName: dataset?.name ?? "Unknown",
          limit,
          documents: docs,
          provider: preferences.provider,
          model: preferences.model,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }

      await fetchData();
      setDatasetId("");
      setProgress(1);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger benchmark");
    } finally {
      setTriggering(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-success";
      case "running": return "text-warning";
      default: return "text-muted";
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 border-success/20";
      case "running": return "bg-warning/10 border-warning/20";
      default: return "bg-muted/10 border-muted/20";
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Benchmarks</h1>

        {/* Trigger */}
        <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
          <h2 className="font-semibold mb-2">Run Benchmark</h2>
          <p className="text-sm text-muted mb-6">
            Evaluate retrieval quality against a dataset using Recall@k, Precision@k, Hit Rate@k, and LLM-based generation metrics.
          </p>
          <form onSubmit={handleTrigger} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Dataset</label>
              <select
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              >
                <option value="">Select a dataset...</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.rowCount.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Question Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            {triggerError && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {triggerError}
              </p>
            )}
            <button
              type="submit"
              disabled={triggering || !datasetId}
              className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {triggering ? "Running..." : "Run Benchmark"}
            </button>
          </form>

          {/* ── Running overlay ── */}
          {triggering && (
            <div className="mt-6 bg-[#03111a] border border-accent/20 rounded-2xl p-5 overflow-hidden relative">
              {/* retro progress bar */}
              <div className="h-2 bg-bg rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              {/* cycling status */}
              <div className="flex items-center gap-3 min-h-[2.5rem]">
                <span className="text-accent font-mono text-sm animate-pulse">
                  {RUN_PHASES[phaseIdx]}
                </span>
              </div>

              <p className="text-xs text-muted mt-3 font-mono">
                &gt; Benchmarking {limit} questions against {datasets.find(d => d.id === datasetId)?.name || "dataset"}...
              </p>
            </div>
          )}
        </div>

        {/* History */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-muted text-center py-12">Loading benchmarks...</p>
        ) : runs.length === 0 ? (
          <p className="text-muted text-center py-12">No benchmarks yet. Trigger one above!</p>
        ) : (
          <div>
            <h2 className="font-semibold mb-4">History ({runs.length})</h2>
            <div className="space-y-3">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/benchmarks/${run.id}`}
                  className="block bg-bg-alt rounded-2xl border border-line p-5 hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{run.datasetName}</h3>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${statusBg(run.status)} ${statusColor(run.status)}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{run.totalQuestions} questions</span>
                    <span className="text-muted">&rarr;</span>
                  </div>
                  {run.metrics && (
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line">
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Recall@k</span>
                        <ScoreBadge score={run.metrics.recallAtK} />
                      </div>
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Precision@k</span>
                        <ScoreBadge score={run.metrics.precisionAtK} />
                      </div>
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Hit Rate@k</span>
                        <ScoreBadge score={run.metrics.hitRateAtK} />
                      </div>
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Faithfulness</span>
                        <ScoreBadge score={run.metrics.faithfulness} />
                      </div>
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Relevance</span>
                        <ScoreBadge score={run.metrics.answerRelevance} />
                      </div>
                      <div>
                        <span className="text-xs text-muted block mb-0.5">Context Use</span>
                        <ScoreBadge score={run.metrics.contextUtilization} />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}