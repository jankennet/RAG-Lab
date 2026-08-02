import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { createChunks } from "@/server/rag/chunker";
import { parseContent } from "@/server/ingestion";

export const runtime = "nodejs";

const DOCUMENT_FIELDS = ["documents", "document"];

function pickDocumentsField(row: Record<string, unknown>, preferred?: string): string {
  // If preferred field exists in row, use it regardless of name
  if (preferred && row[preferred] != null) return preferred;

  for (const candidate of DOCUMENT_FIELDS) {
    const match = Object.keys(row).find((field) => field.toLowerCase() === candidate);
    if (match) return match;
  }

  // Return preferred even for fields not named documents/document
  if (preferred) return preferred;

  return Object.keys(row)[0] ?? "";
}

function normalizeDocumentsValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item == null) return "";
        return typeof item === "object" ? JSON.stringify(item) : String(item);
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (value == null) return "";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

const createDatasetSchema = z.object({
  name: z.string().min(1).max(256),
  source: z.enum(["huggingface"]),
  datasetName: z.string().max(512),
  datasetConfig: z.string().max(128).optional(),
  datasetSplit: z.string().max(128).optional(),
  maxRows: z.coerce.number().int().positive().max(10000).default(100),
  sourceUrl: z.string().max(2048).optional(),
  contentField: z.string().max(128).optional(),
  titleField: z.string().max(128).optional(),
});

/**
 * POST: Fetch dataset from HuggingFace, chunk with ROS chunker, return to client.
 * Client stores in OPFS — no server DB.
 */
export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const body = createDatasetSchema.parse(await request.json());

    if (!body.datasetName?.includes("/")) {
      return NextResponse.json({
        error: `Invalid dataset ID: "${body.datasetName}". Use format "org/name" (e.g., "galileo-ai/ragbench").`,
      }, { status: 400 });
    }

    const { downloadHfRows } = await import("@/server/ingestion/download");
    let result;
    try {
      result = await downloadHfRows(
        body.datasetName,
        body.datasetConfig ?? "default",
        body.datasetSplit ?? "train",
        body.maxRows,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("404") || msg.includes("not found")) {
        return NextResponse.json({
          error: `Dataset "${body.datasetName}" not found on HuggingFace. Check the name and try again.`,
        }, { status: 404 });
      }
      return NextResponse.json({
        error: `HuggingFace API error: ${msg}`,
      }, { status: 502 });
    }

    const { rows, fieldHints } = parseContent(result.raw, result.contentType);

    if (rows.length === 0) {
      return NextResponse.json({
        error: `No data returned from "${body.datasetName}"/"${body.datasetConfig ?? "default"}"/"${body.datasetSplit ?? "train"}". Try a different config or split.`,
      }, { status: 502 });
    }

    const contentField = pickDocumentsField(rows[0], body.contentField || fieldHints.content || undefined);
    const chunks = rows.flatMap((row, i) => {
      const raw = row[contentField];
      if (raw == null) return [];

      // Array of documents: chunk each separately for clean focused chunks
      if (Array.isArray(raw)) {
        return raw.flatMap((doc, j) => {
          const content = typeof doc === "string" ? doc.trim() : typeof doc === "object" ? JSON.stringify(doc, null, 2) : String(doc);
          if (!content) return [];
          const title = content.length > 60 ? content.slice(0, 60) + "..." : content;
          return createChunks({
            sourceName: body.name,
            sourceUrl: body.sourceUrl ?? null,
            sourceKeyPrefix: `${body.name}:row:${i}:doc:${j}`,
            title: `row-${i}: ${title}`,
            content,
            metadata: {},
          });
        });
      }

      // Single string or other value
      const content = typeof raw === "string" ? raw.trim() : normalizeDocumentsValue(raw);
      if (!content) return [];

      return createChunks({
        sourceName: body.name,
        sourceUrl: body.sourceUrl ?? null,
        sourceKeyPrefix: `${body.name}:row:${i}`,
        title: `row-${i}`,
        content,
        metadata: {},
      });
    });

    return NextResponse.json({ chunks });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[datasets] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}