import { NextResponse } from "next/server";
import { z } from "zod";
import { applyApiGuard, serverError, RateLimits } from "@/server/auth/guard";
import { getProviderKey } from "@/server/auth/key-cookie";
import { generateSyntheticDataset } from "@/server/rag/synthetic";

export const runtime = "nodejs";

const syntheticSchema = z.object({
  documents: z.array(
    z.object({
      sourceKey: z.string().default("doc-1"),
      title: z.string().default("Untitled"),
      content: z.string().min(10),
    }),
  ).min(1),
  provider: z.enum(["nvidia", "openai", "anthropic"]).default("nvidia"),
  model: z.string().min(1).default("meta/llama-3.3-70b-instruct"),
  numQuestions: z.number().int().min(1).max(50).default(10),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const body = syntheticSchema.parse(await request.json());
    const { documents, provider, model, numQuestions } = body;

    const rawKey = await getProviderKey(provider);
    if (!rawKey) {
      return NextResponse.json(
        { error: `Missing API key for provider "${provider}"` },
        { status: 400 },
      );
    }

    const apiKeys = { [provider]: { key: rawKey } };
    const dataset = await generateSyntheticDataset({
      provider,
      model,
      apiKeys,
      documents,
      numQuestions,
    });

    return NextResponse.json({
      success: true,
      count: dataset.length,
      questions: dataset,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request payload", details: error.errors }, { status: 400 });
    }
    console.error("[synthetic dataset] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}
