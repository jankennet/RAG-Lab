import { NextResponse } from "next/server";
import { getSessionApiKeys } from "@/server/auth/session";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";
import { PROVIDERS } from "@/shared/types";
import type { LlmProvider } from "@/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_MODELS: Record<LlmProvider, string[]> = {
  nvidia: [
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.1-405b-instruct",
    "mistralai/mistral-large",
    "google/gemma-2-27b-it",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
    "o1",
    "o3-mini",
  ],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-haiku-4-20251001",
    "claude-opus-5-20251001",
    "claude-opus-4-20250514",
    "claude-3-5-sonnet-latest",
    "claude-3-opus-latest",
    "claude-3-haiku-latest",
  ],
};

interface OpenAiModelEntry {
  id: string;
}

interface OpenAiModelsResponse {
  data?: OpenAiModelEntry[];
}

async function fetchOpenAiCompatibleModels(
  endpoint: string,
  apiKey: string,
  filter: (id: string) => boolean = () => true,
): Promise<string[]> {
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as OpenAiModelsResponse;
    return (payload.data ?? []).map((m) => m.id).filter(filter).sort();
  } catch {
    return [];
  }
}

async function fetchNvidiaModels(apiKey: string): Promise<string[]> {
  return fetchOpenAiCompatibleModels(
    "https://integrate.api.nvidia.com/v1/models",
    apiKey,
    (id) => !id.includes("embed") && !id.includes("rerank"),
  );
}

async function fetchOpenAiModels(apiKey: string): Promise<string[]> {
  return fetchOpenAiCompatibleModels(
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

    const apiKeys = await getSessionApiKeys();
    const entry = apiKeys[provider];
    const hasKey = (entry?.key?.length ?? 0) > 0;

    let models: string[] = [];
    let fetched = false;

    if (hasKey) {
      switch (provider) {
        case "nvidia":
          models = await fetchNvidiaModels(entry!.key);
          break;
        case "openai":
          models = await fetchOpenAiModels(entry!.key);
          break;
        case "anthropic":
          // Anthropic has no public list-models endpoint — rely on fallback
          break;
      }
      if (models.length > 0) fetched = true;
    }

    // Fall back to curated defaults if API fetch fails or no key
    if (models.length === 0) {
      models = FALLBACK_MODELS[provider];
    }

    const config = PROVIDERS.find((p) => p.value === provider);

    return NextResponse.json({
      provider,
      models,
      fetched,
      defaultModel: config?.defaultModel ?? models[0] ?? "",
    });
  } catch (error) {
    console.error("[models] GET error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}