"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Dataset } from "@/shared/types";
import DatasetCard from "@/app/(dashboard)/components/DatasetCard";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [source, setSource] = useState<"huggingface" | "upload" | "url">("huggingface");
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/datasets");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Status ${res.status}`);
      }
      const data = await res.json();
      setDatasets(data.datasets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load datasets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setIsAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          source,
          sourceUrl: source !== "upload" ? url.trim() : undefined,
          datasetName: source === "huggingface" ? url.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }

      await fetchDatasets();
      setName("");
      setUrl("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add dataset");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/datasets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Status ${res.status}`);
      }
      await fetchDatasets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dataset");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Datasets</h1>

        {/* Add form */}
        <div className="bg-bg-alt rounded-2xl border border-line p-6 mb-8">
          <h2 className="font-semibold mb-4">Add New Dataset</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Dataset Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                placeholder="e.g., My Support KB"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as typeof source)}
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              >
                <option value="huggingface">Hugging Face</option>
                <option value="upload">Upload File</option>
                <option value="url">URL</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">
                {source === "huggingface" ? "Dataset ID" : source === "url" ? "URL" : "File Path"}
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  source === "huggingface"
                    ? "e.g., galileo-ai/ragbench"
                    : source === "url"
                      ? "https://example.com/data.json"
                      : "/path/to/file.pdf"
                }
                required
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              />
            </div>
            {addError && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {addError}
              </p>
            )}
            <button
              type="submit"
              disabled={isAdding}
              className="w-full px-4 py-2.5 bg-accent text-[#03111a] font-semibold rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAdding ? "Adding..." : "Add Dataset"}
            </button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-muted text-center py-12">Loading datasets...</p>
        ) : datasets.length === 0 ? (
          <p className="text-muted text-center py-12">No datasets yet. Add one above!</p>
        ) : (
          <div>
            <h2 className="font-semibold mb-4">Your Datasets ({datasets.length})</h2>
            <div className="space-y-3">
              {datasets.map((dataset) => (
                <div key={dataset.id} className="relative group">
                  <Link href={`/datasets/${dataset.id}`}>
                    <DatasetCard dataset={dataset} />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm(`Delete "${dataset.name}"?`)) handleDelete(dataset.id);
                    }}
                    className="absolute top-3 right-3 text-xs text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}