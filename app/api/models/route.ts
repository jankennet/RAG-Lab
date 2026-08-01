import { NextResponse } from "next/server";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";
import type { LlmProvider } from "@/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CURATED_MODELS: Record<LlmProvider, string[]> = {
  nvidia: [
    "meta/llama-3.3-70b-instruct",
    "meta/llama-3.1-70b-instruct",
    "mistralai/mistral-large",
    "google/gemma-2-27b-it",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20251001",
    "claude-opus-5-20251001",
    "claude-3-5-sonnet-latest",
    "claude-3-opus-latest",
  ],
};

interface OpenAiModelEntry {
  id: string;
}

async function fetchModelsFromEndpoint(
  endpoint: string,
  apiKey: string,
  filter: (id: string) => boolean = () => true,
): Promise<string[]> {
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: OpenAiModelEntry[] };
    return (payload.data ?? []).map((m) => m.id).filter(filter).sort();
  } catch {
    return [];
  }
}

async function fetchNvidiaModels(apiKey: string): Promise<string[]> {
  return fetchModelsFromEndpoint(
    "https://integrate.api.nvidia.com/v1/models",
    apiKey,
    (id) => !id.includes("embed") && !id.includes("rerank"),
  );
}

async function fetchOpenAiModels(apiKey: string): Promise<string[]> {
  return fetchModelsFromEndpoint(
    "https://api.openai.com/v1/models",
    apiKey,
    (id) => id.startsWith("gpt-") || id.startsWith("o1") || id.startsWith("o3"),
  );
}

export async function GET(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") as LlmProvider | null;

    if (!provider || !["nvidia", "openai", "anthropic"].includes(provider)) {
      return badRequest("Invalid or missing ?provider= parameter");
    }

    // Use API key from Authorization header (sent by client from localStorage)
    const authHeader = request.headers.get("Authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let models: string[] = [];
    let fetched = false;

    if (apiKey) {
      switch (provider) {
        case "nvidia":
          models = await fetchNvidiaModels(apiKey);
          break;
        case "openai":
          models = await fetchOpenAiModels(apiKey);
          break;
        case "anthropic":
          break;
      }
      if (models.length > 0) fetched = true;
    }

    if (models.length === 0) {
      models = CURATED_MODELS[provider];
    }

    return NextResponse.json({
      provider,
      models,
      fetched,
      defaultModel: models[0] ?? "",
    });
  } catch (error) {
    console.error("[models] GET error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}