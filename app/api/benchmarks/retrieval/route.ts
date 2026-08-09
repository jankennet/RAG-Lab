import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { evaluateRetrieval } from "@/server/rag/retrieval-eval";

export const runtime = "nodejs";

// Layer 2 — retrieval quality. Deterministic, no LLM, no API key.
// CI-safe: run on every PR to catch retrieval regressions.

const retrievalSchema = z.object({
  topK: z.number().int().min(1).max(100).default(5),
  questions: z
    .array(
      z.object({
        id: z.string().optional(),
        question: z.string().min(1),
        relevantDocIds: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(500),
  documents: z
    .array(
      z.object({
        sourceKey: z.string().optional(),
        title: z.string().optional(),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = retrievalSchema.parse(await request.json());
    const corpus = body.documents.map((d, i) => ({
      sourceKey: d.sourceKey ?? `doc-${i}`,
      title: d.title ?? "",
      content: d.content,
    }));
    const questions = body.questions.map((q, i) => ({
      id: q.id ?? `q-${i}`,
      question: q.question,
      relevantDocIds: q.relevantDocIds,
    }));

    const evalResult = evaluateRetrieval(questions, corpus, body.topK);

    return NextResponse.json({
      topK: body.topK,
      metrics: {
        recallAtK: evalResult.recallAtK,
        precisionAtK: evalResult.precisionAtK,
        mrr: evalResult.mrr,
        labeledCount: evalResult.labeledCount,
      },
      perQuestion: evalResult.perQuestion,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    console.error("[benchmarks/retrieval] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}