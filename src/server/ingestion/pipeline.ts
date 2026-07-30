/**
 * ROS-aligned ingestion pipeline:
 *   Loader → Parser → Cleaner → Chunker → Embedder → Storage
 *
 * CLI entry point in scripts/ingest.ts. API entry point reuses chunker + embedder.
 */

import { createChunks, selectChunker, type DocumentType } from "@/server/rag/chunker";
import type { IngestedRow } from "@/shared/types";
import { detectSource } from "./detect";
import { download, downloadHfRows, type DownloadResult } from "./download";
import { embedBatch } from "./embed";
import { parseContent, type FieldHints } from "./parse";
import { storeChunks } from "./store";

export type IngestOptions = {
  url: string;
  /** Local file path instead of URL */
  file?: string;
  contentField?: string;
  titleField?: string;
  idField?: string;
  urlField?: string;
  metadataFields?: string[];
  chunkSize?: number;
  chunkOverlap?: number;
  documentType?: DocumentType;
  apiKey: string;
  embeddingModel?: string;
  embeddingDim?: number;
  maxRows?: number;
};

function pickString(row: Record<string, unknown>, field: string): string {
  const v = row[field];
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).filter(Boolean).join("\n\n");
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

async function fetchRows(
  url: string,
  filePath: string | undefined,
  maxRows: number,
): Promise<{ rows: Record<string, unknown>[]; fieldHints: FieldHints }> {
  // Local file takes precedence
  if (filePath) {
    const { readFileSync } = await import("fs");
    const raw = readFileSync(filePath, "utf-8");
    const ct = filePath.endsWith(".csv") ? "text/csv" : filePath.endsWith(".jsonl") ? "application/jsonl" : filePath.endsWith(".json") ? "application/json" : "text/plain";
    return parseContent(raw, ct);
  }

  const src = detectSource(url);

  if (src.source === "hf") {
    const name = src.meta.datasetName ?? url;
    let config = "default";
    let split = "train";

    const parsed = new URL(url);
    if (parsed.searchParams.get("config")) config = parsed.searchParams.get("config")!;
    if (parsed.searchParams.get("split")) split = parsed.searchParams.get("split")!;

    const result = await downloadHfRows(name, config, split, maxRows);
    return parseContent(result.raw, result.contentType);
  }

  if (src.source === "kaggle") {
    throw new Error(
      `Kaggle dataset (${src.meta.fullPath ?? url}) cannot be downloaded automatically. ` +
      `Kaggle requires authentication. Download CSV manually, then:\n\n` +
      `  tsx scripts/ingest.ts --file ./path/to/data.csv --content-field <col>\n\n` +
      `Or use Kaggle CLI:\n` +
      `  kaggle datasets download ${src.meta.fullPath ?? ""} --unzip && ` +
      `tsx scripts/ingest.ts --file ./<file>.csv`
    );
  }

  const result: DownloadResult = await download(url);
  return parseContent(result.raw, result.contentType);
}

export async function runIngestion(opts: IngestOptions): Promise<{
  rows: number;
  chunks: number;
  dir: string;
}> {
  const src = opts.file
    ? { source: "file", name: opts.file.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "dataset", meta: {} as Record<string, string> }
    : detectSource(opts.url);

  // 1. Fetch + parse
  const { rows, fieldHints } = await fetchRows(opts.url, opts.file, opts.maxRows ?? 200);

  if (rows.length === 0) {
    throw new Error("No rows found in dataset");
  }

  // 2. Field mapping (CLI args override auto-detected)
  const contentField = opts.contentField || fieldHints.content || "";
  const titleField = opts.titleField || fieldHints.title || "";
  const idField = opts.idField || fieldHints.id || "";
  const urlField = opts.urlField || fieldHints.url || "";

  if (!contentField) {
    throw new Error(
      `Cannot determine content field. Available: ${Object.keys(rows[0]).join(", ")}. ` +
        "Pass --content-field <name>.",
    );
  }

  // 3. Build metadata list
  const metaFieldsSet = new Set(opts.metadataFields ?? []);
  const autoMetaFields = Object.keys(rows[0]).filter(
    (k) => k !== contentField && k !== titleField && k !== idField && k !== urlField,
  );
  const metadataKeys =
    metaFieldsSet.size > 0
      ? Array.from(metaFieldsSet)
      : autoMetaFields;

  // 4. Build documents with ROS chunker
  const sourceName = src.name;

  const documents: IngestedRow[] = rows.flatMap((row, rowIndex) => {
    const title = titleField ? pickString(row, titleField) : `row-${rowIndex + 1}`;
    const content = pickString(row, contentField).trim();
    if (!content) return [];

    const rowId = idField ? pickString(row, idField) : `${rowIndex + 1}`;
    const sourceUrl = urlField ? pickString(row, urlField) || null : null;
    const metadata: Record<string, unknown> = {};
    for (const key of metadataKeys) {
      if (key in row) metadata[key] = row[key];
    }

    return createChunks({
      sourceName,
      sourceUrl,
      sourceKeyPrefix: `${sourceName}:${rowId}`,
      title,
      content,
      metadata,
      documentType: opts.documentType,
      chunkSize: opts.chunkSize,
      chunkOverlap: opts.chunkOverlap,
    });
  });

  console.log(`Chunks: ${documents.length}. Embedding in batches of 32...`);

  // 5. Embed
  const batchSize = 32;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const embeddings = await embedBatch(
      batch.map((d) => d.content),
      opts.apiKey,
      opts.embeddingModel,
    );
    allEmbeddings.push(...embeddings);
    console.log(`  Embedded ${Math.min(i + batchSize, documents.length)}/${documents.length}`);
  }

  // 6. Store
  const dir = storeChunks(
    sourceName,
    src.source,
    opts.url,
    documents,
    allEmbeddings,
    opts.embeddingDim ?? 1024,
  );

  return {
    rows: rows.length,
    chunks: documents.length,
    dir,
  };
}