import { NextResponse } from "next/server";
import { z } from "zod";
import { formatAnswerSourceList, runRagGraph } from "@/server/rag/graph";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { retrieveFromPythonService, toRagDocuments } from "@/server/rag/retrieval-client";
import type { LlmProvider, RagDocument } from "@/shared/types";

export const runtime = "nodejs";

const documentSchema = z.object({
  id: z.number().optional(),
  sourceKey: z.string().optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  title: z.string().optional(),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  chunkIndex: z.number().optional(),
});

const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(8000),
  topK: z.coerce.number().int().min(1).max(100).default(4),
  temperature: z.coerce.number().min(0).max(2).default(0.2),
  topP: z.coerce.number().min(0).max(1).default(0.9),
  maxTokens: z.coerce.number().int().min(1).max(32768).default(4096),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).max(256).default("meta/llama-3.3-70b-instruct"),
  apiKey: z.string().max(512).optional(),
  /** Client-supplied documents (fallback / OPFS keyword search results) */
  documents: z.array(documentSchema).default([]),
  /** Active dataset ID for server-side retrieval */
  datasetId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.chat);
    if (guard) return guard;

    const payload = chatRequestSchema.parse(await request.json());

    // Build API key store from request body
    const apiKeys: Partial<Record<LlmProvider, { key: string; validated: boolean }>> = {};
    if (payload.apiKey) {
      apiKeys[payload.provider] = { key: payload.apiKey, validated: false };
    }

    if (!apiKeys[payload.provider]?.key) {
      return NextResponse.json(
        { error: `No API key configured for ${payload.provider}. Set it in Settings.` },
        { status: 400 },
      );
    }

    let documents: RagDocument[] = [];

    // Try Python service first (vector search)
    const serviceResult = await retrieveFromPythonService(
      payload.question,
      undefined,
      undefined,
      payload.topK,
    );

    if (serviceResult && serviceResult.results.length > 0) {
      documents = toRagDocuments(serviceResult.results).slice(0, payload.topK);
    } else {
      // Fallback: use client-supplied documents (OPFS keyword search)
      documents = payload.documents.map((doc, i) => ({
        id: doc.id ?? i,
        sourceKey: doc.sourceKey ?? "",
        sourceName: doc.sourceName ?? "",
        sourceUrl: doc.sourceUrl ?? null,
        title: doc.title ?? `Document ${i + 1}`,
        content: doc.content,
        metadata: doc.metadata ?? {},
        chunkIndex: doc.chunkIndex ?? i,
      }));
    }

    const response = await runRagGraph(payload.question, {
      temperature: payload.temperature,
      topP: payload.topP,
      maxTokens: payload.maxTokens,
      provider: payload.provider as LlmProvider,
      model: payload.model,
      apiKeys,
      documents: documents.slice(0, payload.topK),
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