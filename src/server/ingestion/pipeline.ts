/**
 * ROS-aligned ingestion pipeline:
 *   Loader → Parser → Cleaner → Chunker → Embedder → Storage
 *
 * CLI entry point in scripts/ingest.ts. API entry point reuses chunker + embedder.
 */

import { createChunks, selectChunker, type DocumentType } from "@/server/rag/chunker";
import type { IngestedRow } from "@/shared/types";
import { detectFileType, BINARY_EXTS } from "./detect";
import { download, downloadHfRows, type DownloadResult } from "./download";
import { embedBatch } from "./embed";
import { parseContent, type FieldHints } from "./parse";
import { shouldKeepField } from "./field-filter";
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

function cleanText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Format a row as readable markdown block.
 * Produces `**Key**: Value` pairs for LLM comprehension, with long text fields
 * extracted into dedicated paragraphs for complete context fidelity.
 */
function formatRowAsMarkdown(
  row: Record<string, unknown>,
  contentField: string,
  allFields: string[],
): string {
  // Content field gets standalone paragraph for full semantic context
  const contentValue = cleanText(pickString(row, contentField));
  const lines: string[] = [];

  // Emit other fields as compact key-value metadata block
  const otherFields = allFields.filter((f) =>
    shouldKeepField(f, contentField) && row[f] != null && String(row[f]).trim() !== ""
  );
  if (otherFields.length > 0) {
    const kvPairs = otherFields.map((f) => {
      const val = cleanText(pickString(row, f));
      // Truncate long values in the header line (full value in content already)
      const short = val.length > 200 ? val.slice(0, 200) + "..." : val;
      return `**${f.replace(/_/g, " ")}**: ${short}`;
    });
    lines.push(kvPairs.join(" | "));
  }

  // Main content as dedicated paragraph
  if (contentValue) {
    lines.push("");
    lines.push(contentValue);
  }

  return lines.join("\n").trim();
}

/**
 * Extract text from binary files (DOCX, XLSX, PDF, images).
 * Uses mammoth/xlsx for office docs, delegates PDF/images to Python OCR service.
 */
async function extractBinaryFile(filePath: string): Promise<string> {
  const { readFileSync } = await import("fs");
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
  const buffer = readFileSync(filePath);

  try {
    // DOCX → mammoth
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // XLSX → xlsx library
    if (ext === ".xlsx" || ext === ".xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (csv.trim()) parts.push(`Sheet: ${name}\n${csv}`);
      }
      return parts.join("\n\n");
    }

    // PDF / images → Python OCR service
    if (ext === ".pdf" || [".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"].includes(ext)) {
      const { writeFileSync, mkdtempSync } = await import("fs");
      const { join } = await import("path");
      const { tmpdir } = await import("os");
      const dir = mkdtempSync(join(tmpdir(), "rag-ingest-"));
      const tmpPath = join(dir, filePath.split("/").pop() || "file");
      writeFileSync(tmpPath, buffer);

      try {
        const res = await fetch("http://127.0.0.1:8001/extract-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({ file_path: tmpPath, ocr_lang: "eng" }),
        });
        if (!res.ok) throw new Error(`Python service returned ${res.status}`);
        const data = (await res.json()) as { text: string };
        return data.text;
      } catch (err) {
        throw new Error(
          `Failed to extract "${filePath}". Python OCR service unavailable. ` +
          `Run: npm run rag-service\n  ${(err as Error).message}`
        );
      }
    }
  } catch (err) {
    throw new Error(`Failed to extract binary file "${filePath}": ${(err as Error).message}`);
  }

  throw new Error(`Unsupported binary format: ${ext}`);
}

async function fetchRows(
  url: string,
  filePath: string | undefined,
  maxRows: number,
): Promise<{ rows: Record<string, unknown>[]; fieldHints: FieldHints }> {
  // Local file takes precedence
  if (filePath) {
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
    const isBinary = BINARY_EXTS.has(ext);

    if (isBinary) {
      // Binary file (DOCX, XLSX, PDF, image) — use appropriate extractor
      const raw = await extractBinaryFile(filePath);
      return parseContent(raw, ext === ".docx" ? "text/plain" : ext === ".xlsx" || ext === ".xls" ? "text/csv" : "text/plain");
    }

    const { readFileSync } = await import("fs");
    const raw = readFileSync(filePath, "utf-8");
    const ct = filePath.endsWith(".csv") ? "text/csv" : filePath.endsWith(".jsonl") ? "application/jsonl" : filePath.endsWith(".json") ? "application/json" : filePath.endsWith(".sql") ? "text/plain" : filePath.endsWith(".md") ? "text/markdown" : "text/plain";
    return parseContent(raw, ct);
  }

  // HuggingFace dataset URL
  const hfMatch = url.match(/huggingface\.co\/datasets\/([^/]+(?:\/[^/]+)?)/);
  if (hfMatch) {
    const name = hfMatch[1];
    let config = "default";
    let split = "train";

    try {
      const parsed = new URL(url);
      if (parsed.searchParams.get("config")) config = parsed.searchParams.get("config")!;
      if (parsed.searchParams.get("split")) split = parsed.searchParams.get("split")!;
    } catch { /* invalid URL */ }

    const result = await downloadHfRows(name, config, split, maxRows);
    return parseContent(result.raw, result.contentType);
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
    : { source: "url", name: new URL(opts.url).pathname.split("/").filter(Boolean).pop()?.replace(/\.[^.]+$/, "") ?? "dataset", meta: {} as Record<string, string> };

  // 1. Fetch + parse
  const { rows, fieldHints } = await fetchRows(opts.url, opts.file, opts.maxRows ?? 200);

  if (rows.length === 0) {
    throw new Error("No rows found in dataset");
  }

  const maxRows = opts.maxRows ?? 200;
  const limitedRows = rows.slice(0, maxRows);
  if (limitedRows.length < rows.length) {
    console.log(`Limiting ingest to ${limitedRows.length}/${rows.length} rows`);
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
    (k) => shouldKeepField(k, contentField, titleField) && k !== idField && k !== urlField,
  );
  const metadataKeys =
    metaFieldsSet.size > 0
      ? Array.from(metaFieldsSet)
      : autoMetaFields;

  // 4. Build documents with ROS chunker
  const sourceName = src.name;

  // Determine if this is tabular/structured data (multiple columns) vs prose
  const allFieldNames = Object.keys(limitedRows[0] || {});
  const isTabular = allFieldNames.length >= 3 && contentField;

  const documents: IngestedRow[] = limitedRows.flatMap((row, rowIndex) => {
    const title = titleField ? cleanText(pickString(row, titleField)) : `row-${rowIndex + 1}`;
    const content = isTabular
      ? formatRowAsMarkdown(row, contentField, allFieldNames)
      : cleanText(pickString(row, contentField));
    if (!content) return [];

    const rowId = idField ? cleanText(pickString(row, idField)) : `${rowIndex + 1}`;
    const sourceUrl = urlField ? cleanText(pickString(row, urlField)) || null : null;
    const metadata: Record<string, unknown> = {};
    for (const key of metadataKeys) {
      if (key in row) metadata[key] = row[key];
    }

    metadata.rowIndex = rowIndex;
    metadata.contentField = contentField;
    metadata.titleField = titleField || undefined;
    metadata.documentType = isTabular ? "structured-row" : "freeform";

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
    rows: limitedRows.length,
    chunks: documents.length,
    dir,
  };
}