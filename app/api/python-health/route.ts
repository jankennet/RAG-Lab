import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RAG_SERVICE_URL = "http://127.0.0.1:8001";

/** Proxy health check to Python service. Avoids CORS from browser. */
export async function GET() {
  try {
    const res = await fetch(`${RAG_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ running: false, status: res.status });
    }
    const data = await res.json();
    return NextResponse.json({ running: true, ...data });
  } catch {
    return NextResponse.json({ running: false });
  }
}