import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/server/db/supabase";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

const createBenchmarkSchema = z.object({
  datasetId: z.string().min(1).max(64),
  questionField: z.string().min(1).max(128).default("question"),
  referenceField: z.string().min(1).max(128).default("answer"),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export async function GET(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("benchmark_runs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[benchmarks] db error:", error.message);
      return serverError();
    }

    return NextResponse.json({
      benchmarks: (data ?? []).map((b: Record<string, unknown>) => ({
        id: b.id,
        datasetId: b.dataset_id,
        datasetName: b.dataset_name ?? "Unknown",
        totalQuestions: b.total_questions ?? 0,
        averageScore: b.average_score ?? 0,
        status: b.status ?? "pending",
        createdAt: b.created_at ? new Date(b.created_at as string).getTime() : Date.now(),
      })),
    });
  } catch (error) {
    console.error("[benchmarks] GET error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = createBenchmarkSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data: dataset } = await supabase
      .from("datasets")
      .select("name")
      .eq("id", body.datasetId)
      .single();

    const { data, error } = await supabase
      .from("benchmark_runs")
      .insert({
        dataset_id: body.datasetId,
        dataset_name: (dataset as Record<string, unknown> | null)?.name ?? "Unknown",
        total_questions: body.limit,
        average_score: 0,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[benchmarks] db insert error:", error.message);
      return serverError();
    }

    const mapped = data as Record<string, unknown>;

    return NextResponse.json({
      benchmark: {
        id: mapped.id,
        datasetId: mapped.dataset_id,
        datasetName: mapped.dataset_name ?? "N/A",
        totalQuestions: mapped.total_questions ?? 0,
        averageScore: mapped.average_score ?? 0,
        status: mapped.status ?? "pending",
        createdAt: mapped.created_at ? new Date(mapped.created_at as string).getTime() : Date.now(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[benchmarks] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}