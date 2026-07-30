import { NextResponse } from "next/server";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

/** Maximum per-file size sent to server. PDF parsing is memory-intensive server-side. */
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_TOTAL_SIZE = 2000 * 1024 * 1024; // 2 GB total

/** Text-only file types parsed client-side. PDF sent to server. */
const SERVER_PARSED_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
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

  if (ext !== ".pdf") {
    throw new Error(`Text files are parsed in browser. Only PDFs need server. Remove "${filename}" from upload.`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`PDF too large: ${filename} (max ${MAX_FILE_SIZE / 1024 / 1024} MB). Try a smaller file.`);
  }

  const content = await extractPdfText(buffer);
  const metadata: Record<string, unknown> = { filename, fileType: ext };

  if (content.trim().length === 0) {
    throw new Error(`PDF "${filename}" produced no extractable text. It may be image-only (scanned). Try OCR tools first.`);
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