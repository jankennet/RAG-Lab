import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { fetchHuggingFaceDatasetRows } from "@/server/datasets/hf-datasets";

export const runtime = "nodejs";

const createDatasetSchema = z.object({
  name: z.string().min(1).max(256),
  source: z.enum(["huggingface", "url"]),
  sourceUrl: z.string().max(2048).optional(),
  datasetName: z.string().max(512).optional(),
  datasetConfig: z.string().max(128).optional(),
  datasetSplit: z.string().max(128).optional(),
  maxRows: z.coerce.number().int().positive().max(10000).default(100),
});

/**
 * POST: Fetch from HuggingFace or URL, parse into chunks, return to client.
 * Client stores in OPFS — no server DB.
 */
export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const body = createDatasetSchema.parse(await request.json());

    if (body.source === "huggingface") {
      if (!body.datasetName) {
        return NextResponse.json({ error: "datasetName is required for HuggingFace" }, { status: 400 });
      }

      const rows = await fetchHuggingFaceDatasetRows({
        datasetName: body.datasetName,
        datasetConfig: body.datasetConfig ?? "default",
        split: body.datasetSplit ?? "train",
        limit: body.maxRows,
      });

      const chunks = rows.flatMap((row, i) => {
        const title = String(row.title ?? row.id ?? `row-${i}`);
        const content = String(row.text ?? row.content ?? row.documents ?? JSON.stringify(row));
        const metadata: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (k !== "title" && k !== "text" && k !== "content" && k !== "documents") {
            metadata[k] = v;
          }
        }

        // Simple chunking server-side
        const text = content.replace(/\s+/g, " ").trim();
        const chunkSize = 1000;
        const result: Array<Record<string, unknown>> = [];
        let start = 0;
        let chunkIdx = 0;
        while (start < text.length) {
          const end = Math.min(text.length, start + chunkSize);
          result.push({
            sourceKey: `${body.name}:row:${i}:chunk:${chunkIdx}`,
            sourceName: body.name,
            sourceUrl: body.sourceUrl ?? null,
            title: `${title}`,
            content: text.slice(start, end).trim(),
            metadata: { ...metadata, rowIndex: i, chunkIndex: chunkIdx },
            chunkIndex: chunkIdx,
          });
          if (end >= text.length) break;
          start = Math.max(0, end - 150);
          chunkIdx++;
        }
        return result;
      });

      return NextResponse.json({ chunks });
    }

    if (body.source === "url") {
      // Fetch URL content
      if (!body.sourceUrl) {
        return NextResponse.json({ error: "sourceUrl is required for URL source" }, { status: 400 });
      }

      const res = await fetch(body.sourceUrl);
      if (!res.ok) {
        return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 502 });
      }

      const contentType = res.headers.get("content-type") ?? "";
      let content: string;
      if (contentType.includes("json")) {
        const json = await res.json();
        content = JSON.stringify(json, null, 2);
      } else {
        content = await res.text();
      }

      const text = content.replace(/\s+/g, " ").trim();
      const chunks: Array<Record<string, unknown>> = [];
      let start = 0;
      let chunkIdx = 0;
      while (start < text.length) {
        const end = Math.min(text.length, start + 1000);
        chunks.push({
          id: chunkIdx,
          sourceKey: `${body.name}:url:chunk:${chunkIdx}`,
          sourceName: body.name,
          sourceUrl: body.sourceUrl,
          title: `${body.name} (${body.sourceUrl})`,
          content: text.slice(start, end).trim(),
          metadata: { source: "url", url: body.sourceUrl, chunkIndex: chunkIdx },
          chunkIndex: chunkIdx,
        });
        if (end >= text.length) break;
        start = Math.max(0, end - 150);
        chunkIdx++;
      }

      return NextResponse.json({ chunks });
    }

    // Should not reach here (both branches return)
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[datasets] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

