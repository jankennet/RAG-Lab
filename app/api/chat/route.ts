import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAnswerSourceList, runRagGraph } from "@/server/rag/graph";
import { getSessionApiKeys } from "@/server/auth/session";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import type { LlmProvider } from "@/shared/types";

export const runtime = "nodejs";

const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(8000),
  topK: z.coerce.number().int().min(1).max(20).default(4),
  temperature: z.coerce.number().min(0).max(2).default(0.2),
  topP: z.coerce.number().min(0).max(1).default(0.9),
  maxTokens: z.coerce.number().int().min(1).max(32768).default(4096),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).max(256).default("meta/llama-3.1-70b-instruct"),
  datasetId: z.string().max(256).optional(),
  apiKey: z.string().max(512).optional(),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.chat);
    if (guard) return guard;

    const payload = chatRequestSchema.parse(await request.json());

    // Read API keys from encrypted httpOnly cookie first
    const apiKeys = await getSessionApiKeys();

    // Fallback: use apiKey from request body if cookie has none for this provider
    if (!apiKeys[payload.provider]?.key && payload.apiKey) {
      apiKeys[payload.provider] = { key: payload.apiKey, validated: false };
    }

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
      temperature: payload.temperature,
      topP: payload.topP,
      maxTokens: payload.maxTokens,
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