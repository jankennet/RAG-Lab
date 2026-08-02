import { NextResponse } from "next/server";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_TOTAL_SIZE = 2000 * 1024 * 1024; // 2 GB

const RAG_SERVICE_URL = "http://127.0.0.1:8001";

type ParsedFile = {
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
};

// ── Format detection ────────────────────────────────────────────

const TEXT_EXTS = new Set([".txt", ".md", ".text", ".rst", ".html", ".htm", ".xml"]);
const CSV_EXTS = new Set([".csv"]);
const JSON_EXTS = new Set([".json", ".jsonl"]);
const DOCX_EXTS = new Set([".docx"]);
const XLSX_EXTS = new Set([".xlsx", ".xls"]);
const SQL_EXTS = new Set([".sql"]);
const PDF_EXTS = new Set([".pdf"]);
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"]);

function detectFormat(filename: string): "text" | "csv" | "json" | "docx" | "xlsx" | "sql" | "pdf" | "image" | "binary" {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  if (TEXT_EXTS.has(ext)) return "text";
  if (CSV_EXTS.has(ext)) return "csv";
  if (JSON_EXTS.has(ext)) return "json";
  if (DOCX_EXTS.has(ext)) return "docx";
  if (XLSX_EXTS.has(ext)) return "xlsx";
  if (SQL_EXTS.has(ext)) return "sql";
  if (PDF_EXTS.has(ext)) return "pdf";
  if (IMAGE_EXTS.has(ext)) return "image";
  return "binary";
}

// ── Text-based extractors ───────────────────────────────────────

function extractText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

function extractCsv(buffer: Buffer): string {
  const raw = buffer.toString("utf-8").trim();
  const lines = raw.split("\n").filter(Boolean);
  if (lines.length < 2) return raw;

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) =>
    line.split(",").map((c) => c.trim()),
  );

  // Format as markdown table
  const mdLines: string[] = [];
  mdLines.push(`| ${headers.join(" | ")} |`);
  mdLines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const row of rows.slice(0, 200)) {
    // Pad/slice row to match header count
    const padded = [...row];
    while (padded.length < headers.length) padded.push("");
    mdLines.push(`| ${padded.slice(0, headers.length).join(" | ")} |`);
  }

  if (rows.length > 200) {
    mdLines.push("");
    mdLines.push(`_${rows.length - 200} more rows not shown_`);
  }

  return mdLines.join("\n");
}

function extractJson(buffer: Buffer): string {
  // Pretty-print compact JSON/JSONL
  const raw = buffer.toString("utf-8").trim();
  const lines = raw.split("\n").filter(Boolean);
  if (lines.length > 1 && lines.every((l) => l.trim().startsWith("{"))) {
    // JSONL — return as-is
    return raw;
  }
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// ── Binary format extractors ────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) {
      parts.push(`## Sheet: ${sheetName}`);
      const lines = csv.trim().split("\n").filter(Boolean);
      if (lines.length >= 2) {
        const headers = lines[0].split(",").map((h) => h.trim());
        parts.push(`| ${headers.join(" | ")} |`);
        parts.push(`| ${headers.map(() => "---").join(" | ")} |`);
        const maxRows = Math.min(lines.length - 1, 200);
        for (let i = 1; i <= maxRows; i++) {
          const cells = lines[i].split(",").map((c) => c.trim());
          const padded = [...cells];
          while (padded.length < headers.length) padded.push("");
          parts.push(`| ${padded.slice(0, headers.length).join(" | ")} |`);
        }
      } else {
        parts.push(csv);
      }
    }
  }
  return parts.join("\n\n");
}

// ── OCR delegate to Python service ──────────────────────────────

async function extractViaPythonService(
  filePath: string,
  mimeType: string,
): Promise<{ text: string; title: string }> {
  const res = await fetch(`${RAG_SERVICE_URL}/extract-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      file_path: filePath,
      mime_type: mimeType,
      ocr_lang: "eng",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Python extract failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text: string; title: string };
  return data;
}

/** Extract text from PDF via pdftotext CLI (poppler-utils). Works for text-layer PDFs. */
async function extractViaPdftotext(filePath: string): Promise<string> {
  const { execSync } = await import("child_process");
  try {
    const result = execSync(`pdftotext "${filePath}" - -q -l 5`, {
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 100 * 1024 * 1024,
    });
    return (result || "").trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // pdftotext returns non-zero for encrypted PDFs, but often still outputs text
    // Try reading any partial output
    return "";
  }
}

// ── Main parseOneFile ───────────────────────────────────────────

async function writeTempFile(buffer: Buffer, filename: string): Promise<string> {
  const { writeFileSync, mkdtempSync } = await import("fs");
  const { join } = await import("path");
  const { tmpdir } = await import("os");
  const dir = mkdtempSync(join(tmpdir(), "rag-upload-"));
  const path = join(dir, filename);
  writeFileSync(path, buffer);
  return path;
}

async function parseOneFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filename} (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }

  const format = detectFormat(filename);
  let content: string;
  let metadata: Record<string, unknown> = { filename, fileType: ext };

  switch (format) {
    case "text":
      content = extractText(buffer);
      break;

    case "csv":
      content = extractCsv(buffer);
      metadata.fileType = "csv";
      break;

    case "json":
      content = extractJson(buffer);
      metadata.fileType = "json";
      break;

    case "docx":
      content = await extractDocx(buffer);
      metadata.fileType = "docx";
      if (!content.trim()) throw new Error(`DOCX "${filename}" produced no text.`);
      break;

    case "xlsx":
      content = await extractXlsx(buffer);
      metadata.fileType = "xlsx";
      if (!content.trim()) throw new Error(`XLSX "${filename}" produced no text.`);
      break;

    case "sql":
      content = extractText(buffer);
      metadata.fileType = "sql";
      break;

    case "pdf":
    case "image":
      // Try pdftotext CLI first (handles text-layer PDFs, no Python needed)
      // Fall back to Python OCR service for image-based PDFs
      if (format === "pdf") {
        try {
          const tempPath = await writeTempFile(buffer, filename);
          const text = await extractViaPdftotext(tempPath);
          const { rmSync } = await import("fs");
          rmSync(tempPath, { recursive: true, force: true });
          if (text) {
            content = text;
            metadata.fileType = ext;
            metadata.extraction_method = "pdftotext";
            break; // skip to content validation
          }
        } catch {
          // pdftotext failed — fall through to Python OCR
        }
      }

      // Python OCR fallback for image PDFs / images
      try {
        const tempPath = await writeTempFile(buffer, filename);
        const result = await extractViaPythonService(tempPath, `application/${ext === ".pdf" ? "pdf" : "octet-stream"}`);
        content = result.text;
        metadata.fileType = ext;
        metadata.extraction_method = "python_ocr";
        const { rmSync } = await import("fs");
        rmSync(tempPath, { recursive: true, force: true });
      } catch (err) {
        const isPdf = ext === ".pdf";
        throw new Error(
          `Failed to extract text from "${filename}": ${(err as Error).message}. ` +
          (isPdf
            ? "PDF appears image-based (no text layer). Python OCR service required: npm run rag-service."
            : "Images require Python OCR service: npm run rag-service. See python-service/README.md.")
        );
      }
      break;

    default:
      // Binary fallback: try Python service
      try {
        const tempPath = await writeTempFile(buffer, filename);
        const result = await extractViaPythonService(tempPath, "application/octet-stream");
        content = result.text;
        metadata.fileType = ext;
        const { rmSync } = await import("fs");
        rmSync(tempPath, { recursive: true, force: true });
      } catch (err) {
        throw new Error(
          `Unsupported file type "${ext}". For PDFs/images, ensure Python service is running.`
        );
      }
      break;
  }

  if (content.trim().length === 0) {
    throw new Error(`File "${filename}" produced no extractable text.`);
  }

  return { filename, content, metadata };
}

// ── POST handler ────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const formData = await request.formData();

    const rawFiles: File[] = [];
    {
      const single = formData.get("file");
      if (single && typeof single !== "string") rawFiles.push(single);
    }
    for (const entry of formData.getAll("files")) {
      if (typeof entry !== "string") rawFiles.push(entry);
    }

    if (rawFiles.length === 0) {
      return badRequest("No files provided. Use 'file' or 'files' form field.");
    }

    const totalSize = rawFiles.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return badRequest(`Total file size too large (max ${MAX_TOTAL_SIZE / 1024 / 1024} MB)`);
    }

    const results: ParsedFile[] = [];
    for (const f of rawFiles) {
      const buffer = Buffer.from(await f.arrayBuffer());
      try {
        results.push(await parseOneFile(buffer, f.name || "upload"));
      } catch (err) {
        return badRequest((err as Error).message);
      }
    }

    return NextResponse.json({
      parsed: true,
      fileCount: results.length,
      files: results,
    });
  } catch (error) {
    console.error("[upload] error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}