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
};

type ParsedFile = {
  filename: string;
  content: string;
  metadata: Record<string, unknown>;
};

function parseOneFile(buffer: Buffer, filename: string): ParsedFile {
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  const mimeType = ALLOWED_TYPES[ext];
  if (!mimeType) {
    throw new Error(`Unsupported file type: ${ext}. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${filename} (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }

  const raw = buffer.toString("utf-8");
  const metadata: Record<string, unknown> = { filename, fileType: ext };

  let content: string;

  if (ext === ".json") {
    const parsed = JSON.parse(raw);
    metadata.jsonKeys = Array.isArray(parsed) ? "array" : Object.keys(parsed).join(",");
    metadata.rowCount = Array.isArray(parsed) ? parsed.length : 1;
    content = JSON.stringify(parsed, null, 2);
  } else if (ext === ".csv") {
    const lines = raw.split("\n").filter(Boolean);
    metadata.rowCount = Math.max(0, lines.length - 1);
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
        results.push(parseOneFile(buffer, f.name || "upload"));
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