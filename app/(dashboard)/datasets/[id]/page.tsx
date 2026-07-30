"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import DatasetCard from "../../components/DatasetCard";
import SourceCard from "../../components/SourceCard";
import { loadIndex, loadDocuments, chunkText, makeDocuments, updateDatasetChunks } from "@/client/opfs";
import type { OpfsDataset, OpfsDocument } from "@/client/opfs";

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<OpfsDataset | null>(null);
  const [chunks, setChunks] = useState<OpfsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const index = await loadIndex();
      const ds = index.find((d) => d.id === id) ?? null;
      setDataset(ds);
      if (ds) {
        const docs = await loadDocuments(ds.id);
        setChunks(docs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReindex = async () => {
    if (!dataset) return;
    setReindexing(true);
    try {
      const docs = await loadDocuments(dataset.id);
      // Re-chunk: join all document content, re-chunk, store back
      const allContent = docs.map((d) => d.content).join("\n\n");
      const newChunks = chunkText(allContent, 1000, 150);
      const newDocs = makeDocuments(dataset.name, null, dataset.name, newChunks, { reindexed: true });
      await updateDatasetChunks(dataset.id, newDocs);
      await load();
    } catch (err) {
      console.error("Reindex failed:", err);
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <p className="text-muted text-center py-12">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
            <p className="text-danger text-sm">{error ?? "Dataset not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-muted mb-1">Dataset detail</p>
            <h1 className="text-2xl font-bold">{dataset.name}</h1>
            <p className="text-sm text-muted mt-1">
              Source: {dataset.source}
              {dataset.sourceUrl && (
                <>
                  {" · "}
                  <a href={dataset.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Link
                  </a>
                </>
              )}
            </p>
          </div>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="px-4 py-2 text-sm font-medium bg-accent/10 border border-accent/20 text-accent rounded-xl hover:bg-accent/15 transition-colors disabled:opacity-40"
          >
            {reindexing ? "Reindexing..." : "Re-index"}
          </button>
        </div>

        {/* Summary */}
        <div className="mb-8">
          <DatasetCard dataset={{
            id: dataset.id,
            name: dataset.name,
            description: `${dataset.chunkCount} chunks · ${dataset.source}`,
            source: dataset.source,
            sourceUrl: dataset.sourceUrl ?? undefined,
            rowCount: dataset.rowCount,
            createdAt: dataset.createdAt,
            status: "ready" as const,
          }} />
        </div>

        {/* Chunks */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Chunks</h2>
            <span className="text-sm text-muted">{chunks.length} documents</span>
          </div>
          {chunks.length === 0 ? (
            <p className="text-muted text-sm py-8 text-center">No chunks indexed yet.</p>
          ) : (
            <div>
              {chunks.map((source, idx) => (
                <SourceCard key={source.sourceKey} source={source} index={idx} />
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="bg-bg-alt rounded-2xl border border-line p-6">
          <h2 className="font-semibold mb-4">Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-line/50">
              <span className="text-muted">Source</span>
              <span className="font-medium">{dataset.source}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/50">
              <span className="text-muted">Chunks</span>
              <span className="font-medium">{dataset.chunkCount}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-line/50">
              <span className="text-muted">Rows</span>
              <span className="font-medium">{dataset.rowCount}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted">Created</span>
              <span className="font-medium">{new Date(dataset.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}