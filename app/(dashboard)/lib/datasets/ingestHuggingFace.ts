// HuggingFace dataset ingest for the /datasets route: POSTs the HF params to
// /api/datasets and persists the returned chunks to OPFS. Kept separate from
// benchmark-datasets' import (that uses /api/benchmark-datasets + a different
// persist shape) — see Phase 4's useDatasetImport for the shared hook. Lifted
// from datasets/page.tsx handleAdd's `source === "huggingface"` branch
// (L299-326). Trim is applied here, at the fetch boundary, exactly as the page
// did, so callers can pass raw form state.

import { createDataset, updateDatasetChunks } from "@/client/opfs";

export type IngestHuggingFaceParams = {
  name: string;
  /** HF dataset id (owner/name). Trimmed before use. */
  datasetName: string;
  datasetConfig: string;
  datasetSplit: string;
  maxRows: number;
  onProgress?: (message: string) => void;
};

export type IngestHuggingFaceResult = {
  /** null when the remote returned no chunks (no dataset persisted). */
  datasetId: string | null;
  chunkCount: number;
};

export async function ingestHuggingFace({
  name,
  datasetName,
  datasetConfig,
  datasetSplit,
  maxRows,
  onProgress,
}: IngestHuggingFaceParams): Promise<IngestHuggingFaceResult> {
  const trimmedName = name.trim();
  const trimmedId = datasetName.trim();
  const sourceUrl = `https://huggingface.co/datasets/${trimmedId}`;

  onProgress?.("Fetching from HuggingFace...");
  const res = await fetch("/api/datasets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: trimmedName,
      source: "huggingface",
      datasetName: trimmedId,
      datasetConfig: datasetConfig.trim(),
      datasetSplit: datasetSplit.trim(),
      maxRows,
      sourceUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to fetch dataset");
  }

  const remoteDocs = (data as { chunks?: Array<Record<string, unknown>> }).chunks ?? [];
  let datasetId: string | null = null;
  if (remoteDocs.length > 0) {
    const dataset = await createDataset({
      name: trimmedName,
      source: "huggingface",
      sourceUrl,
    });
    await updateDatasetChunks(
      dataset.id,
      remoteDocs as unknown as Parameters<typeof updateDatasetChunks>[1],
    );
    datasetId = dataset.id;
  }
  onProgress?.(`${remoteDocs.length} chunks`);

  return { datasetId, chunkCount: remoteDocs.length };
}
