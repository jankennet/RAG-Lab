import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const createDatasetSchema = z.object({
  name: z.string().min(1).max(256),
  source: z.enum(["huggingface", "upload", "url"]),
  sourceUrl: z.string().url().optional(),
  datasetName: z.string().optional(),     // HF dataset name
  datasetConfig: z.string().optional(),   // HF config
  datasetSplit: z.string().optional(),    // HF split
  maxRows: z.coerce.number().int().positive().default(100),
});

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      datasets: (data ?? []).map((d: Record<string, unknown>) => ({
        id: d.id,
        name: d.name,
        source: d.source,
        sourceUrl: d.source_url ?? null,
        rowCount: d.row_count ?? 0,
        status: d.status ?? "ready",
        createdAt: d.created_at ? new Date(d.created_at as string).getTime() : Date.now(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = createDatasetSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("datasets")
      .insert({
        name: body.name,
        source: body.source,
        source_url: body.sourceUrl ?? null,
        row_count: 0,
        status: "loading",
        metadata: {
          dataset_name: body.datasetName ?? null,
          dataset_config: body.datasetConfig ?? null,
          dataset_split: body.datasetSplit ?? null,
          max_rows: body.maxRows ?? 100,
        },
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = data as Record<string, unknown>;

    return NextResponse.json({
      dataset: {
        id: mapped.id,
        name: mapped.name,
        source: mapped.source,
        sourceUrl: mapped.source_url ?? null,
        rowCount: mapped.row_count ?? 0,
        status: mapped.status ?? "loading",
        createdAt: mapped.created_at ? new Date(mapped.created_at as string).getTime() : Date.now(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("datasets").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}