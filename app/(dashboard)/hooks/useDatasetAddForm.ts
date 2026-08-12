// Add-dataset form state: owns the name/source toggle, HuggingFace subset+split
// auto-fetch, and multi-file upload selection, then dispatches to the pure
// `ingestUpload` / `ingestHuggingFace` libs on submit. Lifted verbatim from
// datasets/page.tsx — the HF config/split debounce logic is copied as-is (it
// hits the public HF APIs client-side) and only the persist branch is swapped
// for the shared libs. The component layer (3d) renders this state; this hook
// owns no JSX.
//
// Reset policy is byte-identical to the page's `resetForm`: it clears name,
// the HF fields, files, error, and progress — but deliberately leaves
// `source` untouched (the page never reset it either).

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { DatasetSource } from "@/shared/types";
import { ingestHuggingFace } from "@/app/(dashboard)/lib/datasets/ingestHuggingFace";
import { ingestUpload } from "@/app/(dashboard)/lib/datasets/ingestUpload";

export type DatasetAddSource = DatasetSource;

export type DatasetAddForm = ReturnType<typeof useDatasetAddForm>;

export function useDatasetAddForm(options?: { onAdded?: () => void }) {
  const onAddedRef = useRef(options?.onAdded);
  onAddedRef.current = options?.onAdded;

  const [name, setName] = useState("");
  const [source, setSource] = useState<DatasetAddSource>("huggingface");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Upload state — multiple files (selection only; drag/drop visuals live in
  // the UploadDropzone component).
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

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

  const reset = useCallback(() => {
    setName("");
    setHfDatasetId("");
    setHfConfig("default");
    setHfConfigs([]);
    setHfSplits([]);
    setHfSplit("train");
    setHfMaxRows("100");
    setSelectedFiles([]);
    setError(null);
    setProgress(null);
  }, []);

  // Changing source clears the form error, matching the page's onChange.
  const changeSource = useCallback((value: DatasetAddSource) => {
    setSource(value);
    setError(null);
  }, []);

  // ── File selection helpers (drag/drop visuals live in UploadDropzone) ────
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const fresh = Array.from(newFiles).filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...fresh];
    });
  }, []);

  const removeFile = useCallback((idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearFiles = useCallback(() => setSelectedFiles([]), []);

  // ── Handle form submit ──────────────────────────────────────────────────
  const submit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      if (!name.trim()) return;

      if (source === "huggingface" && !hfDatasetId.trim()) {
        setError("Enter a HuggingFace dataset ID");
        return;
      }
      if (source === "upload" && selectedFiles.length === 0) {
        setError("Select at least one file to upload");
        return;
      }

      setIsAdding(true);
      setError(null);

      try {
        if (source === "upload") {
          await ingestUpload({
            name: name.trim(),
            files: selectedFiles,
            onProgress: setProgress,
          });
        } else {
          await ingestHuggingFace({
            name,
            datasetName: hfDatasetId,
            datasetConfig: hfConfig,
            datasetSplit: hfSplit,
            maxRows: parseInt(hfMaxRows, 10) || 100,
            onProgress: setProgress,
          });
        }

        onAddedRef.current?.();
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add dataset");
        setProgress(null);
      } finally {
        setIsAdding(false);
      }
    },
    [name, source, hfDatasetId, hfConfig, hfSplit, hfMaxRows, selectedFiles, reset],
  );

  return {
    // form
    name, setName,
    source, changeSource,
    isAdding,
    error, setError,
    progress,
    reset,
    submit,
    // huggingface
    hfDatasetId, setHfDatasetId,
    hfConfig, setHfConfig,
    hfConfigs, hfConfigsLoading,
    hfSplit, setHfSplit,
    hfSplits, hfSplitsLoading,
    hfMaxRows, setHfMaxRows,
    // upload
    selectedFiles, addFiles, removeFile, clearFiles,
  };
}
