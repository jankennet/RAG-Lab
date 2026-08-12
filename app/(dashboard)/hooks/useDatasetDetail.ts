// Dataset detail state: loads a dataset + its chunks from OPFS, and exposes a
// `reindex` that delegates to `opfs.reindexDataset` (smartChunkText re-split)
// then refetches. Lifted from datasets/[id]/page.tsx's `load` + `handleReindex`.
// Pre-Phase-3 the page re-chunked with the legacy fixed-size `chunkText`; the
// shared `reindexDataset` now uses `smartChunkText` (auto-detects JSON vs
// prose) per the refactor decision — chunk counts may differ from the old
// fixed-size output but that's the intended improvement, not a regression.

"use client";

import { useCallback } from "react";
import { loadDocuments, loadIndex, reindexDataset } from "@/client/opfs";
import type { OpfsDataset, OpfsDocument } from "@/client/opfs";
import { useAsync } from "./useAsync";

type DatasetDetail = { dataset: OpfsDataset | null; chunks: OpfsDocument[] };

const INITIAL: DatasetDetail = { dataset: null, chunks: [] };

export function useDatasetDetail(id: string) {
  const { data, error, loading, isInitialLoading, refetch } = useAsync<DatasetDetail>(
    async () => {
      try {
        const index = await loadIndex();
        const ds = index.find((d) => d.id === id) ?? null;
        const chunks = ds ? await loadDocuments(ds.id) : [];
        return { dataset: ds, chunks };
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to load dataset");
      }
    },
    INITIAL,
    [id],
  );

  const reindex = useCallback(async () => {
    if (!data.dataset) return;
    await reindexDataset(data.dataset.id);
    await refetch();
  }, [data.dataset, refetch]);

  return {
    dataset: data.dataset,
    chunks: data.chunks,
    error,
    loading,
    isInitialLoading,
    reindex,
    refetch,
  };
}
