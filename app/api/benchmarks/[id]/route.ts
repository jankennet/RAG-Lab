import { NextResponse } from "next/server";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { getRuns } from "@/server/benchmarks/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = applyApiGuard(_request, RateLimits.default);
    if (guard) return guard;

    const { id } = await params;
    const store = getRuns();
    const run = store.find((r) => r.id === id);
    if (!run) {
      return NextResponse.json({ error: "Benchmark run not found" }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch {
    return serverError();
  }
}