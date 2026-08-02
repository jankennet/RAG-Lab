import { NextResponse } from "next/server";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";

export const runtime = "nodejs";

// Benchmark detail is read from OPFS client-side.
// This endpoint exists as a fallback for direct API access.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = applyApiGuard(_request, RateLimits.default);
    if (guard) return guard;

    const { id } = await params;
    return NextResponse.json({ id, note: "Benchmark data is stored in OPFS (Origin Private File System). Use client-side loadBenchmarkRun(id) to read." });
  } catch {
    return serverError();
  }
}