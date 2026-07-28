import { NextResponse } from "next/server";
import { createSupabaseReadClient } from "@/server/db/supabase";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const { id } = await params;

    if (!id || id.length > 64) {
      return NextResponse.json({ error: "Invalid dataset id" }, { status: 400 });
    }

    const supabase = createSupabaseReadClient();

    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[datasets/:id] db error:", error.message);
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const { data: chunks, error: chunksError } = await supabase
      .from("documents")
      .select("*")
      .eq("source_name", (data as Record<string, unknown>).name)
      .order("chunk_index", { ascending: true })
      .limit(50);

    if (chunksError) {
      console.warn("[datasets/:id] chunks error:", chunksError.message);
    }

    const d = data as Record<string, unknown>;

    return NextResponse.json({
      dataset: {
        id: d.id,
        name: d.name,
        source: d.source,
        sourceUrl: d.source_url ?? null,
        rowCount: d.row_count ?? 0,
        status: d.status ?? "ready",
        createdAt: d.created_at ? new Date(d.created_at as string).getTime() : Date.now(),
        metadata: d.metadata ?? {},
      },
      chunks: (chunks ?? []).map((c: Record<string, unknown>) => ({
        id: c.id,
        sourceKey: c.source_key,
        sourceName: c.source_name,
        sourceUrl: c.source_url ?? null,
        title: c.title,
        content: c.content,
        metadata: c.metadata ?? {},
        chunkIndex: c.chunk_index ?? 0,
        similarity: c.similarity ?? null,
      })),
    });
  } catch (error) {
    console.error("[datasets/[id]] error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}