"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DatasetCard from "../../components/DatasetCard";
import SourceCard from "../../components/SourceCard";
import type { Dataset, RagDocument } from "@/lib/types";

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [chunks, setChunks] = useState<RagDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/datasets/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? `Status ${res.status}`);
        }
        const data = await res.json();
        setDataset(data.dataset ?? null);
        setChunks(data.chunks ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dataset");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <p className="text-muted p-6">Loading dataset...</p>;
  }

  if (error || !dataset) {
    return <p className="text-red-400 p-6">{error ?? "Dataset not found"}</p>;
  }

  return (
    <section className="p-6">
      <div>
        <p className="text-xs text-muted mb-1">Dataset detail</p>
        <h1 className="text-2xl font-bold">{dataset.name}</h1>
        <p className="text-muted text-sm mt-1">
          Source: {dataset.source}
          {dataset.sourceUrl && (
            <>
              {" · "}
              <a
                href={dataset.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Link
              </a>
            </>
          )}
        </p>
      </div>

      {/* Summary card */}
      <div className="mt-6">
        <DatasetCard dataset={dataset} />
      </div>

      {/* Chunks */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Chunks</h2>
          <span className="text-sm text-muted">{dataset.rowCount} rows</span>
        </div>
        {chunks.length === 0 ? (
          <p className="text-muted text-sm">No chunks indexed yet.</p>
        ) : (
          <div>
            {chunks.map((source, idx) => (
              <SourceCard key={source.id} source={source} index={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Status info */}
      <div className="mt-6 bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-6">
        <h2 className="font-semibold mb-3">Ingestion Status</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Source</span>
            <strong>{dataset.source}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Rows</span>
            <strong>{dataset.rowCount.toLocaleString()}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Status</span>
            <strong>{dataset.status}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Created</span>
            <strong>{new Date(dataset.createdAt).toLocaleDateString()}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}