import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAnswerSourceList, runRagGraph } from "@/lib/graph";
import type { ApiKeyStore, LlmProvider } from "@/lib/types";

export const runtime = "nodejs";

const apiKeyEntrySchema = z.object({
  key: z.string(),
  validated: z.boolean(),
  model: z.string().optional(),
});

const apiKeyStoreSchema: z.ZodType<ApiKeyStore> = z.object({
  nvidia: apiKeyEntrySchema.optional(),
  openai: apiKeyEntrySchema.optional(),
  anthropic: apiKeyEntrySchema.optional(),
  supabaseUrl: z.string().optional(),
  supabaseKey: z.string().optional(),
});

const chatRequestSchema = z.object({
  question: z.string().trim().min(1),
  topK: z.coerce.number().int().min(1).max(8).default(4),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).default("meta/llama-3.1-70b-instruct"),
  apiKeys: apiKeyStoreSchema.default({}),
  datasetId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.parse(await request.json());
    const response = await runRagGraph(payload.question, {
      topK: payload.topK,
      provider: payload.provider as LlmProvider,
      model: payload.model,
      apiKeys: payload.apiKeys,
    });

    return NextResponse.json({
      answer: response.answer,
      documents: response.documents,
      sources: formatAnswerSourceList(response.documents),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}