/** Write chunk files + index to local JSON. */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { IngestedRow } from "@/shared/types";

export const DATA_DIR = join(process.cwd(), "data", "datasets");

export type IndexMeta = {
  dataset: string;
  source: string;
  sourceUrl: string;
  rowCount: number;
  chunkCount: number;
  embeddingDim: number;
  createdAt: number;
};

export function storeChunks(
  datasetName: string,
  source: string,
  sourceUrl: string,
  chunks: IngestedRow[],
  embeddings: number[][],
  embeddingDim: number,
): string {
  const safeName = datasetName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const batchDir = join(DATA_DIR, safeName);
  mkdirSync(batchDir, { recursive: true });

  const batchSize = 32;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const rows = batch.map((doc, bi) => ({
      source_key: doc.sourceKey,
      source_name: doc.sourceName,
      source_url: doc.sourceUrl,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      chunk_index: doc.chunkIndex,
      embedding: embeddings[i + bi],
    }));
    const part = Math.floor(i / batchSize);
    writeFileSync(join(batchDir, `chunks_${part}.json`), JSON.stringify(rows, null, 2));
  }

  const meta: IndexMeta = {
    dataset: datasetName,
    source,
    sourceUrl,
    rowCount: chunks.length > 0 ? new Set(chunks.map((c) => c.sourceKey.split(":chunk:")[0])).size : 0,
    chunkCount: chunks.length,
    embeddingDim,
    createdAt: Date.now(),
  };
  writeFileSync(join(batchDir, "index.json"), JSON.stringify(meta, null, 2));

  return batchDir;
}