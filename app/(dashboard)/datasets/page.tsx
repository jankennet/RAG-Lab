"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Dataset } from "@/lib/types";
import DatasetCard from "@/app/(dashboard)/components/DatasetCard";

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
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

      // Refresh the list
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Datasets</h1>

      {/* Add Dataset Form */}
      <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-6 mb-6">
        <h2 className="font-semibold mb-4">Add New Dataset</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Dataset Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
              placeholder="e.g., My Support KB"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            >
              <option value="huggingface">Hugging Face</option>
              <option value="upload">Upload File</option>
              <option value="url">URL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {source === "huggingface" ? "Hugging Face Dataset ID" : source === "url" ? "URL" : "File Path"}
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
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {addError && <p className="text-red-400 text-sm">{addError}</p>}
          <button
            type="submit"
            disabled={isAdding}
            className="w-full px-4 py-2 bg-accent text-[#03111a] font-bold rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            {isAdding ? "Adding..." : "Add Dataset"}
          </button>
        </form>
      </div>

      {/* Datasets List */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-center py-8">Loading datasets...</p>
      ) : datasets.length === 0 ? (
        <p className="text-muted text-center py-8">No datasets yet. Add one above!</p>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold mb-4">Your Datasets ({datasets.length})</h2>
          <div className="space-y-4">
            {datasets.map((dataset) => (
              <div key={dataset.id} className="relative">
                <Link href={`/datasets/${dataset.id}`}>
                  <DatasetCard dataset={dataset} />
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm(`Delete "${dataset.name}"?`)) handleDelete(dataset.id);
                  }}
                  className="absolute top-3 right-3 text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}