"use client";

import { useState, useEffect, useCallback } from "react";
import type { Dataset } from "@/lib/types";

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

  // Trigger form state
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Benchmarks</h1>

      {/* Trigger Benchmark */}
      <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-6 mb-6">
        <h2 className="font-semibold mb-4">Run Benchmark</h2>
        <p className="text-muted text-sm mb-4">
          Run a retrieval quality benchmark against a dataset using BLEU/ROUGE scoring.
        </p>
        <form onSubmit={handleTrigger} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Dataset</label>
            <select
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              required
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Select a dataset...</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.rowCount.toLocaleString()} rows, {d.source})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Question Limit</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {triggerError && <p className="text-red-400 text-sm">{triggerError}</p>}
          <button
            type="submit"
            disabled={triggering || !datasetId}
            className="w-full px-4 py-2 bg-accent text-[#03111a] font-bold rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {triggering ? "Triggering..." : "Run Benchmark"}
          </button>
        </form>
      </div>

      {/* Run History */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-center py-8">Loading benchmarks...</p>
      ) : runs.length === 0 ? (
        <p className="text-muted text-center py-8">No benchmarks yet. Trigger one above!</p>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold mb-4">Benchmark History ({runs.length})</h2>
          <div className="space-y-4">
            {runs.map((run) => (
              <div
                key={run.id}
                className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold">{run.datasetName}</h3>
                    <p className="text-xs text-muted">
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      run.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : run.status === "running"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted">Questions: </span>
                    <span>{run.totalQuestions}</span>
                  </div>
                  <div>
                    <span className="text-muted">Avg Score: </span>
                    <span className="font-mono">{(run.averageScore * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}