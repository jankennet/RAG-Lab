import { NextResponse } from "next/server";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total across all files

const ALLOWED_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".log": "text/plain",
  ".sql": "text/sql",
};

type ParsedFile = {
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
};

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import so pdf-parse doesn't block startup if unused
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  } catch (err) {
    console.error("[upload] PDF parse error:", err instanceof Error ? err.message : err);
    throw new Error("Failed to extract text from PDF. File may be scanned/image-based (no text layer).");
  }
}

async function parseOneFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();

  // PDF: binary extraction
  if (ext === ".pdf") {
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${filename} (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }
    const content = await extractPdfText(buffer);
    const metadata: Record<string, unknown> = { filename, fileType: ext };

    if (content.trim().length === 0) {
      throw new Error(`PDF "${filename}" produced no extractable text. It may be image-only.`);
    }

    return { filename, content, metadata };
  }

  // All other text-based types
  const mimeType = ALLOWED_TYPES[ext];
  if (!mimeType) {
    throw new Error(`Unsupported file type: ${ext}. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}, .pdf`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filename} (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }

  const raw = buffer.toString("utf-8");
  const metadata: Record<string, string> = { filename, fileType: ext };

  let content: string;

  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    metadata.jsonKeys = Array.isArray(parsed) ? "array" : Object.keys(parsed).join(",");
    metadata.rowCount = String(Array.isArray(parsed) ? parsed.length : 1);
    content = JSON.stringify(parsed, null, 2);
  } else if (ext === ".csv") {
    const lines = raw.split("\n").filter(Boolean);
    metadata.rowCount = String(Math.max(0, lines.length - 1));
    content = raw;
  } else {
    content = raw;
  }

  return { filename, content, metadata };
}

/**
 * Server parses one or more files, returns structured text + metadata per file.
 * Client stitches files into chunks and stores in OPFS.
 */
export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const formData = await request.formData();

    // Collect all files — support "file" (single) and "files" (multiple)
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

    // Check total size
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