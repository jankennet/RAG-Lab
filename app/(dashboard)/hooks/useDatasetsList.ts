// Datasets list state: loads the OPFS index and exposes a delete+refetch.
// Lifted from datasets/page.tsx's `fetchDatasets` + `handleDelete` data paths.
// The page historically swallowed list-load errors (catch → `setDatasets([])`,
// no banner) and surfaced only delete errors in the add-form banner — so this
// hook does not expose `error` for the load path; delete failures throw to the
// caller, which routes them to the same banner the page used.

"use client";

import { useCallback } from "react";
import { deleteDataset, loadIndex } from "@/client/opfs";
import type { OpfsDataset } from "@/client/opfs";
import { useAsync } from "./useAsync";

export function useDatasetsList() {
  const { data: datasets, loading, isInitialLoading, refetch } = useAsync<OpfsDataset[]>(
    () => loadIndex(),
    [],
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDataset(id);
      await refetch();
    },
    [refetch],
  );

  return { datasets, loading, isInitialLoading, refetch, remove };
}
