import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseReadClient, createSupabaseAdminClient } from "@/server/db/supabase";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

const createDatasetSchema = z.object({
  name: z.string().min(1).max(256),
  source: z.enum(["huggingface", "upload", "url"]),
  sourceUrl: z.string().url().max(2048).optional(),
  datasetName: z.string().max(512).optional(),
  datasetConfig: z.string().max(128).optional(),
  datasetSplit: z.string().max(128).optional(),
  maxRows: z.coerce.number().int().positive().max(100000).default(100),
});

export async function GET(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("datasets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[datasets] GET db error:", error.message);
      return serverError();
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
    console.error("[datasets] GET error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

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
      console.error("[datasets] POST db error:", error.message);
      return serverError();
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
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[datasets] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.datasets);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("datasets").delete().eq("id", id);

    if (error) {
      console.error("[datasets] DELETE db error:", error.message);
      return serverError();
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[datasets] DELETE error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}