"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useDashboard } from "../components/DashboardProvider";
import {
  loadIndex,
  createDataset,
  deleteDataset,
  chunkText,
  makeDocuments,
  updateDatasetChunks,
} from "@/client/opfs";
import type { OpfsDataset } from "@/client/opfs";
import DatasetCard from "@/app/(dashboard)/components/DatasetCard";

type SourceType = "huggingface" | "upload";

export default function DatasetsPage() {
  const { setActiveDataset, preferences } = useDashboard();
  const [datasets, setDatasets] = useState<OpfsDataset[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [source, setSource] = useState<SourceType>("huggingface");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // HuggingFace fields
  const [hfDatasetId, setHfDatasetId] = useState("");
  const [hfConfig, setHfConfig] = useState("default");
  const [hfConfigs, setHfConfigs] = useState<string[]>([]);
  const [hfConfigsLoading, setHfConfigsLoading] = useState(false);
  const [hfSplit, setHfSplit] = useState("train");
  const [hfSplits, setHfSplits] = useState<Array<{ config: string; split: string }>>([]);
  const [hfSplitsLoading, setHfSplitsLoading] = useState(false);
  const [hfMaxRows, setHfMaxRows] = useState("100");
  const hfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch available subsets/configs when dataset ID changes
  const loadHfConfigs = useCallback(async (datasetId: string) => {
    if (!datasetId.includes("/") || datasetId.trim().length < 5) {
      setHfConfigs([]);
      return;
    }
    setHfConfigsLoading(true);
    try {
      const res = await fetch(`https://huggingface.co/api/datasets/${encodeURIComponent(datasetId.trim())}`);
      if (!res.ok) { setHfConfigs([]); return; }
      const data = await res.json();
      const configs: string[] = data?.configs?.map((c: { config: string }) => c.config) ?? [];
      setHfConfigs(configs);
      // Default to first config if available and current selection not in list
      if (configs.length > 0) {
        setHfConfig((prev) => configs.includes(prev) ? prev : configs[0]);
      }
    } catch {
      setHfConfigs([]);
    } finally {
      setHfConfigsLoading(false);
    }
  }, []);

  // Debounced config fetch on dataset ID change
  useEffect(() => {
    if (source !== "huggingface") return;
    if (hfDebounceRef.current) clearTimeout(hfDebounceRef.current);
    hfDebounceRef.current = setTimeout(() => {
      if (hfDatasetId.trim()) loadHfConfigs(hfDatasetId);
    }, 600);
    return () => { if (hfDebounceRef.current) clearTimeout(hfDebounceRef.current); };
  }, [hfDatasetId, source, loadHfConfigs]);

  // Fetch available splits when config changes
  const loadHfSplits = useCallback(async (datasetId: string, config: string) => {
    if (!datasetId.includes("/") || !config) { setHfSplits([]); return; }
    setHfSplitsLoading(true);
    try {
      const url = new URL("https://datasets-server.huggingface.co/splits");
      url.searchParams.set("dataset", datasetId.trim());
      url.searchParams.set("config", config);
      const res = await fetch(url);
      if (!res.ok) { setHfSplits([]); return; }
      const data = await res.json();
      const splits = (data?.splits ?? []) as Array<{ config: string; split: string }>;
      setHfSplits(splits);
      // Default to first split if available and current not in list
      if (splits.length > 0) {
        const splitNames = splits.map((s) => s.split);
        setHfSplit((prev) => splitNames.includes(prev) ? prev : splitNames[0]);
      }
    } catch {
      setHfSplits([]);
    } finally {
      setHfSplitsLoading(false);
    }
  }, []);

  // Auto-fetch splits when config changes
  useEffect(() => {
    if (source !== "huggingface" || !hfDatasetId.trim() || !hfConfig.trim()) {
      setHfSplits([]);
      return;
    }
    loadHfSplits(hfDatasetId, hfConfig);
  }, [hfConfig, hfDatasetId, source, loadHfSplits]);

  // URL field
  const [sourceUrl, setSourceUrl] = useState("");

  // Upload state — multiple files
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const index = await loadIndex();
      setDatasets(index);
    } catch {
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const resetForm = () => {
    setName("");
    setHfDatasetId("");
    setHfConfig("default");
    setHfConfigs([]);
    setHfSplits([]);
    setHfSplit("train");
    setHfMaxRows("100");
    setSourceUrl("");
    setSelectedFiles([]);
    setAddError(null);
    setUploadProgress(null);
  };

  // ── File helpers ──────────────────────────────────────

  const addFiles = (newFiles: FileList | File[]) => {
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const fresh = Array.from(newFiles).filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...fresh];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Drop handlers ───────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFilePick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  // ── Handle form submit ──────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (source === "huggingface" && !hfDatasetId.trim()) {
      setAddError("Enter a HuggingFace dataset ID");
      return;
    }
    if (source === "upload" && selectedFiles.length === 0) {
      setAddError("Select at least one file to upload");
      return;
    }

    setIsAdding(true);
    setAddError(null);

    try {
      if (source === "upload") {
        // ── Pre-upload check: files needing Python OCR service? ──
        const OCR_EXTS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"]);
        const needsPython = selectedFiles.some((f) =>
          OCR_EXTS.has(f.name.substring(f.name.lastIndexOf(".")).toLowerCase()),
        );
        if (needsPython) {
          // Health-check Python service via server proxy (no CORS).
          setUploadProgress("Checking Python OCR service...");
          try {
            const healthRes = await fetch("/api/python-health", {
              signal: AbortSignal.timeout(6000),
            });
            const health = await healthRes.json();
            if (!health.running) throw new Error("unreachable");
          } catch {
            const ocrFiles = selectedFiles
              .filter((f) => OCR_EXTS.has(f.name.substring(f.name.lastIndexOf(".")).toLowerCase()))
              .map((f) => f.name)
              .join(", ");
            setUploadProgress(null);
            setIsAdding(false);
            setAddError(
              `Python OCR service not running (http://127.0.0.1:8001). ` +
              `Cannot extract text from: ${ocrFiles}. ` +
              `Start with: npm run rag-service. Non-OCR files (DOCX, XLSX, text) don't need it. ` +
              `See python-service/README.md.`
            );
            return;
          }
        }

        // ── Upload: text files client-side, binary files (PDF/DOCX/XLSX/images) → server ──
        setUploadProgress(`Parsing ${selectedFiles.length} file(s)...`);

        const BINARY_EXTS = new Set([".pdf", ".docx", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"]);
        const textFiles = selectedFiles.filter((f) => !BINARY_EXTS.has(f.name.substring(f.name.lastIndexOf(".")).toLowerCase()));
        const binaryFiles = selectedFiles.filter((f) => BINARY_EXTS.has(f.name.substring(f.name.lastIndexOf(".")).toLowerCase()));

        const parsedTextFiles: Array<{ filename: string; content: string }> = [];

        // Parse text files client-side
        for (const f of textFiles) {
          const raw = await f.text();
          let content = raw;
          if (f.name.toLowerCase().endsWith(".json")) {
            try { content = JSON.stringify(JSON.parse(raw), null, 2); } catch {}
          }
          parsedTextFiles.push({ filename: f.name, content });
        }

        // Parse binary files server-side
        if (binaryFiles.length > 0) {
          const names = binaryFiles.map((f) => f.name).join(", ");
          setUploadProgress(`Uploading ${binaryFiles.length} binary file(s) for parsing: ${names}...`);
          const form = new FormData();
          form.set("datasetName", name.trim());
          for (const f of binaryFiles) {
            form.append("files", f);
          }
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(typeof data.error === "string" ? data.error : "Server parse failed");
          }
          const serverResults = (data as { files?: Array<{ filename: string; content: string }> }).files ?? [];
          parsedTextFiles.push(...serverResults);
        }

        if (parsedTextFiles.length === 0) {
          throw new Error("No files could be parsed.");
        }

        setUploadProgress(`Chunking ${parsedTextFiles.length} file(s)...`);

        let allContent = "";
        const mergedMetadata: Record<string, unknown> = { files: [] as string[] };
        for (const pf of parsedTextFiles) {
          allContent += `\n\n=== ${pf.filename} ===\n\n${pf.content}`;
          (mergedMetadata.files as string[]).push(pf.filename);
        }

        const chunks = chunkText(allContent.trim(), 1000, 150);
        const docs = makeDocuments(name.trim(), null, name.trim(), chunks, mergedMetadata);

        setUploadProgress(`Saving ${chunks.length} chunks to OPFS...`);
        const dataset = await createDataset({ name: name.trim(), source: "upload", sourceUrl: null });
        await updateDatasetChunks(dataset.id, docs);
        setUploadProgress(`${chunks.length} chunks across ${parsedTextFiles.length} files`);
      } else if (source === "huggingface") {
        setUploadProgress("Fetching from HuggingFace...");
        const res = await fetch("/api/datasets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            source: "huggingface",
            datasetName: hfDatasetId.trim(),
            datasetConfig: hfConfig.trim(),
            datasetSplit: hfSplit.trim(),
            maxRows: parseInt(hfMaxRows, 10) || 100,
            sourceUrl: `https://huggingface.co/datasets/${hfDatasetId.trim()}`,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Failed to fetch dataset");
        }

        const remoteDocs = (data as { chunks?: Array<Record<string, unknown>> }).chunks ?? [];
        if (remoteDocs.length > 0) {
          const dataset = await createDataset({ name: name.trim(), source: "huggingface", sourceUrl: `https://huggingface.co/datasets/${hfDatasetId.trim()}` });
          await updateDatasetChunks(dataset.id, remoteDocs as unknown as Parameters<typeof updateDatasetChunks>[1]);
        }
        setUploadProgress(`${remoteDocs.length} chunks`);
      }

      await fetchDatasets();
      resetForm();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add dataset");
      setUploadProgress(null);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this dataset?")) return;
    try {
      await deleteDataset(id);
      await fetchDatasets();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // ── Total size ─────────────────────────────────────────

  const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0);

  // ── Render ───────────────────────────────────────────────

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
                placeholder="e.g., My Knowledge Base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-1.5">Source</label>
              <select
                value={source}
                onChange={(e) => { setSource(e.target.value as SourceType); setAddError(null); }}
                className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
              >
                <option value="huggingface">HuggingFace</option>
                <option value="upload">Upload Files</option>
              </select>
            </div>

            {/* ── HuggingFace fields ── */}
            {source === "huggingface" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Dataset ID</label>
                  <input
                    type="text"
                    value={hfDatasetId}
                    onChange={(e) => setHfDatasetId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="e.g., galileo-ai/ragbench"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Subset</label>
                    {hfConfigs.length > 0 ? (
                      <select
                        value={hfConfig}
                        onChange={(e) => setHfConfig(e.target.value)}
                        className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                      >
                        {hfConfigs.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={hfConfig}
                        onChange={(e) => setHfConfig(e.target.value)}
                        className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                        placeholder={hfConfigsLoading ? "Loading subsets..." : "default"}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Split</label>
                    {hfSplits.length > 0 ? (
                      <select
                        value={hfSplit}
                        onChange={(e) => setHfSplit(e.target.value)}
                        className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                      >
                        {hfSplits.map((s) => (
                          <option key={s.split} value={s.split}>{s.split}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={hfSplit}
                        onChange={(e) => setHfSplit(e.target.value)}
                        className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                        placeholder={hfSplitsLoading ? "Loading splits..." : "train"}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Max Rows</label>
                    <input
                      type="number"
                      value={hfMaxRows}
                      onChange={(e) => setHfMaxRows(e.target.value)}
                      min={1}
                      max={100000}
                      className="w-full px-3 py-2 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Multi-file upload drop zone ── */}
            {source === "upload" && (
              <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                  Files ({selectedFiles.length} selected)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.json,.csv,.html,.htm,.xml,.log,.sql,.pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleFilePick}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-accent bg-accent/5"
                      : selectedFiles.length > 0
                        ? "border-success/40 bg-success/5"
                        : "border-line hover:border-accent/30"
                  }`}
                >
                  {selectedFiles.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-text">
                        {selectedFiles.length} file(s) — {(totalSize / 1024).toFixed(1)} KB total
                      </p>
                      <p className="text-xs text-accent mt-1">Drop more or click to add</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-text">
                        Drop files here or click to browse
                      </p>
                      <p className="text-xs text-muted mt-1">
                        TXT, JSON, CSV, MD, HTML, SQL, PDF, DOCX, XLSX, images · Stored in OPFS (browser storage)
                      </p>
                    </div>
                  )}
                </div>

                {/* File list */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {selectedFiles.map((f, i) => (
                      <div
                        key={f.name + f.lastModified}
                        className="flex items-center justify-between bg-[#03111a] border border-line rounded-lg px-3 py-2 text-xs"
                      >
                        <span className="text-text truncate mr-3 flex-1 min-w-0">{f.name}</span>
                        <span className="text-muted flex-shrink-0 mr-3">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                          className="text-muted hover:text-danger transition-colors flex-shrink-0"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-xs text-muted hover:text-danger transition-colors mt-1 block"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {addError && (
              <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{addError}</p>
            )}

            {/* Progress */}
            {uploadProgress && (
              <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">{uploadProgress}</p>
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

        {/* Dataset list */}
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
                    <DatasetCard
                      dataset={{
                        id: dataset.id,
                        name: dataset.name,
                        description: `${dataset.chunkCount} chunks · ${dataset.source}`,
                        source: dataset.source,
                        sourceUrl: dataset.sourceUrl ?? undefined,
                        rowCount: dataset.rowCount,
                        createdAt: dataset.createdAt,
                        status: "ready" as const,
                      }}
                    />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(dataset.id);
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