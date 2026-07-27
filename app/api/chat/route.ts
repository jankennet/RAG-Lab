import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAnswerSourceList, runRagGraph } from "@/lib/graph";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  question: z.string().trim().min(1),
  topK: z.coerce.number().int().min(1).max(8).default(4)
});

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.parse(await request.json());
    const response = await runRagGraph(payload.question, payload.topK);

    return NextResponse.json({
      answer: response.answer,
      documents: response.documents,
      sources: formatAnswerSourceList(response.documents)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}