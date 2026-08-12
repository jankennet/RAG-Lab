// Client-side ingest for uploaded files: pre-flight Python-OCR health, parse
// text files locally, hand binary files to /api/upload, merge, smart-chunk,
// persist to OPFS. Lifted verbatim from datasets/page.tsx handleAdd's
// `source === "upload"` branch (L210-298) so the hook layer stays free of
// parsing detail. Behavior-identical: same health-check, same /api/upload
// contract, same merge separator, same chunk size, same metadata shape.

import {
  createDataset,
  makeDocuments,
  smartChunkText,
  updateDatasetChunks,
} from "@/client/opfs";
import { BINARY_EXTS, OCR_EXTS, fileExt } from "./fileExts";

export type IngestUploadResult = {
  datasetId: string;
  chunkCount: number;
  fileCount: number;
};

export type IngestUploadParams = {
  /** Dataset name (already trimmed by the caller). */
  name: string;
  files: File[];
  /** Streams the same human-readable progress strings the page showed inline. */
  onProgress?: (message: string) => void;
};

export async function ingestUpload({
  name,
  files,
  onProgress,
}: IngestUploadParams): Promise<IngestUploadResult> {
  // ── Pre-upload check: files needing Python OCR service? ──
  const needsPython = files.some((f) => OCR_EXTS.has(fileExt(f.name)));
  if (needsPython) {
    // Health-check Python service via server proxy (no CORS).
    onProgress?.("Checking Python OCR service...");
    try {
      const healthRes = await fetch("/api/python-health", {
        signal: AbortSignal.timeout(6000),
      });
      const health = await healthRes.json();
      if (!health.running) throw new Error("unreachable");
    } catch {
      const ocrFiles = files
        .filter((f) => OCR_EXTS.has(fileExt(f.name)))
        .map((f) => f.name)
        .join(", ");
      throw new Error(
        `Python OCR service not running (http://127.0.0.1:8001). ` +
        `Cannot extract text from: ${ocrFiles}. ` +
        `Start with: npm run rag-service. Non-OCR files (DOCX, XLSX, text) don't need it. ` +
        `See python-service/README.md.`
      );
    }
  }

  // ── Upload: text files client-side, binary files (PDF/DOCX/XLSX/images) → server ──
  onProgress?.(`Parsing ${files.length} file(s)...`);

  const textFiles = files.filter((f) => !BINARY_EXTS.has(fileExt(f.name)));
  const binaryFiles = files.filter((f) => BINARY_EXTS.has(fileExt(f.name)));

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
    onProgress?.(`Uploading ${binaryFiles.length} binary file(s) for parsing: ${names}...`);
    const form = new FormData();
    form.set("datasetName", name);
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

  onProgress?.(`Chunking ${parsedTextFiles.length} file(s)...`);

  let allContent = "";
  const mergedMetadata: Record<string, unknown> = { files: [] as string[] };
  for (const pf of parsedTextFiles) {
    allContent += `\n\n=== ${pf.filename} ===\n\n${pf.content}\n`;
    (mergedMetadata.files as string[]).push(pf.filename);
  }

  const chunks = smartChunkText(allContent.trim(), { chunkSize: 1000, chunkOverlap: 150 });
  const docs = makeDocuments(name, null, name, chunks, mergedMetadata);

  onProgress?.(`Saving ${chunks.length} chunks to OPFS...`);
  const dataset = await createDataset({ name, source: "upload", sourceUrl: null });
  await updateDatasetChunks(dataset.id, docs);
  onProgress?.(`${chunks.length} chunks across ${parsedTextFiles.length} files`);

  return { datasetId: dataset.id, chunkCount: chunks.length, fileCount: parsedTextFiles.length };
}
