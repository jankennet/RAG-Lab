"use client";

import { useEffect, useState } from "react";
import { loadIndex, loadBenchmarkRuns } from "@/client/opfs";

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export default function AboutPage() {
  const [datasetCount, setDatasetCount] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [completedRuns, setCompletedRuns] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([loadIndex(), loadBenchmarkRuns()])
      .then(([datasets, runs]) => {
        if (!active) return;
        setDatasetCount(datasets.length);
        setChunkCount(datasets.reduce((sum, dataset) => sum + dataset.chunkCount, 0));
        setCompletedRuns(runs.filter((run) => run.status === "completed").length);
      })
      .catch(() => {
        if (!active) return;
        setDatasetCount(0);
        setChunkCount(0);
        setCompletedRuns(0);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Browser-native lab</p>
          <h1 className="text-3xl font-bold tracking-tight">Import, chunk, embed, store, compare.</h1>
          <p className="max-w-3xl text-sm text-muted leading-6">
            Local-first RAG lab. Data stays in OPFS. Preferences stay in localStorage. API keys are encrypted server-side in httpOnly cookies. No server DB.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-bg-alt p-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted">OPFS</p>
            <p className="font-medium text-text">{formatCount(datasetCount, "dataset")}</p>
            <p className="text-sm text-muted">{formatCount(chunkCount, "chunk")} stored locally</p>
            <p className="text-sm text-muted">{formatCount(completedRuns, "completed benchmark run")}</p>
          </div>

          <div className="rounded-2xl border border-line bg-bg-alt p-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted">localStorage</p>
            <p className="font-medium text-text">Preferences (no API keys)</p>
            <p className="text-sm text-muted">Provider, model, dataset, and inference settings stay in the browser.</p>
            <p className="text-sm text-muted">API keys are encrypted server-side. Nothing here needs a backend database.</p>
          </div>
        </section>

        <section className="flex flex-wrap gap-2">
          {[
            "Import Dataset",
            "Chunk",
            "Embed",
            "Store in OPFS",
            "Chat",
            "Inspect Retrieval",
            "Benchmark",
            "Compare Pipelines",
          ].map((step, index) => (
            <div key={step} className="flex items-center gap-2 rounded-full border border-line bg-bg-alt px-3 py-1.5 text-xs text-muted">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-semibold text-accent">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}