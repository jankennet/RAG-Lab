import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Compare data is computed client-side from OPFS.
export async function GET() {
  return NextResponse.json({ groups: [], byDataset: [] });
}