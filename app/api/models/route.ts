import { NextResponse } from "next/server";
import { getSessionApiKeys } from "@/server/auth/session";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";
import type { LlmProvider } from "@/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Curated known models per provider — used as fallback when no API key
// or for Anthropic (no public list-models endpoint).
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

/**
 * Resolve an API key for the given provider. Checks in order:
 * 1. Authorization header (Bearer token) — passed by client from localStorage
 * 2. Server session cookie
 */
async function resolveApiKey(request: Request, provider: LlmProvider): Promise<string | null> {
  // 1. Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. Session cookie
  const sessionKeys = await getSessionApiKeys();
  const entry = sessionKeys[provider];
  if (entry?.key) return entry.key;

  return null;
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

    const apiKey = await resolveApiKey(request, provider);

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
          // Anthropic has no public list-models endpoint
          break;
      }
      if (models.length > 0) fetched = true;
    }

    // Fall back to curated list when fetch fails, no key, or Anthropic
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