import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/server/db/supabase";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    // Fetch dataset metadata
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Fetch document chunks for this dataset
    const { data: chunks, error: chunksError } = await supabase
      .from("documents")
      .select("*")
      .eq("source_name", (data as Record<string, unknown>).name)
      .order("chunk_index", { ascending: true })
      .limit(50);

    if (chunksError) {
      console.warn("Failed to fetch chunks:", chunksError.message);
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}