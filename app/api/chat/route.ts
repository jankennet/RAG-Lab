import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAnswerSourceList, runRagGraph } from "@/server/rag/graph";
import { getSessionApiKeys } from "@/server/auth/session";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import type { LlmProvider } from "@/shared/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(8000),
  topK: z.coerce.number().int().min(1).max(8).default(4),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).max(256).default("meta/llama-3.1-70b-instruct"),
  datasetId: z.string().max(256).optional(),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.chat);
    if (guard) return guard;

    const payload = chatRequestSchema.parse(await request.json());

    // Read API keys from encrypted httpOnly cookie — never from the request body
    const apiKeys = await getSessionApiKeys();

    // Ensure the requested provider has a key
    const entry = apiKeys[payload.provider];
    if (!entry?.key) {
      return NextResponse.json(
        { error: `No API key configured for ${payload.provider}. Set it in Settings.` },
        { status: 400 },
      );
    }

    const response = await runRagGraph(payload.question, {
      topK: payload.topK,
      provider: payload.provider as LlmProvider,
      model: payload.model,
      apiKeys,
    });

    return NextResponse.json({
      answer: response.answer,
      documents: response.documents,
      sources: formatAnswerSourceList(response.documents),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("[chat] error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}