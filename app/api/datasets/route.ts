import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { createChunks } from "@/server/rag/chunker";
import { parseContent } from "@/server/ingestion";

export const runtime = "nodejs";

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

    const contentField = body.contentField || fieldHints.content || Object.keys(rows[0])[0];
    const titleField = body.titleField || fieldHints.title || "";

    const chunks = rows.flatMap((row, i) => {
      const title = titleField ? String(row[titleField] ?? "") : `row-${i}`;
      const content = String(row[contentField] ?? JSON.stringify(row));
      const metadata: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k !== contentField && k !== titleField) metadata[k] = v;
      }

      return createChunks({
        sourceName: body.name,
        sourceUrl: body.sourceUrl ?? null,
        sourceKeyPrefix: `${body.name}:row:${i}`,
        title,
        content,
        metadata,
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