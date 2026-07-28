"use client";

import { useState, useEffect, useCallback } from "react";
import type { Dataset } from "@/shared/types";

type BenchmarkRun = {
  id: string;
  datasetId: string;
  datasetName: string;
  totalQuestions: number;
  averageScore: number;
  status: string;
  createdAt: number;
};

export default function BenchmarksPage() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [datasetId, setDatasetId] = useState("");
  const [limit, setLimit] = useState(10);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, datasetsRes] = await Promise.all([
        fetch("/api/benchmarks"),
        fetch("/api/datasets"),
      ]);

      if (!runsRes.ok) throw new Error("Benchmarks fetch failed");
      if (!datasetsRes.ok) throw new Error("Datasets fetch failed");

      const runsData = await runsRes.json();
      const datasetsData = await datasetsRes.json();

      setRuns(runsData.benchmarks ?? []);
      setDatasets(datasetsData.datasets ?? []);
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
      const res = await fetch("/api/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId, limit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }

      await fetchData();
      setDatasetId("");
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
            Evaluate retrieval quality against a dataset using BLEU/ROUGE scoring.
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
                <div
                  key={run.id}
                  className="bg-bg-alt rounded-2xl border border-line p-5"
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted block text-xs mb-0.5">Questions</span>
                      <span className="font-medium">{run.totalQuestions}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-xs mb-0.5">Avg Score</span>
                      <span className="font-mono font-medium">{(run.averageScore * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}