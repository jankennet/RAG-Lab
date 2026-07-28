import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { getSessionApiKeys, setSessionApiKeys, clearSessionApiKeys } from "@/server/auth/session";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";
import type { ApiKeyStore, LlmProvider } from "@/shared/types";

export const runtime = "nodejs";

// ── Validation ──────────────────────────────────────────────

async function testNvidiaKey(key: string): Promise<boolean> {
  try {
    const model = new ChatOpenAI({
      model: "meta/llama-3.1-70b-instruct",
      apiKey: key,
      configuration: { baseURL: "https://integrate.api.nvidia.com/v1" },
      maxTokens: 1,
    });
    await model.invoke([new HumanMessage("Hi")]);
    return true;
  } catch {
    return false;
  }
}

async function testOpenAIKey(key: string): Promise<boolean> {
  try {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: key,
      maxTokens: 1,
    });
    await model.invoke([new HumanMessage("Hi")]);
    return true;
  } catch {
    return false;
  }
}

async function testAnthropicKey(key: string): Promise<boolean> {
  try {
    const model = new ChatAnthropic({
      model: "claude-sonnet-4-20250514",
      apiKey: key,
      maxTokens: 1,
    });
    await model.invoke([new HumanMessage("Hi")]);
    return true;
  } catch {
    return false;
  }
}

async function validateKey(provider: LlmProvider, key: string): Promise<boolean> {
  switch (provider) {
    case "nvidia": return testNvidiaKey(key);
    case "openai": return testOpenAIKey(key);
    case "anthropic": return testAnthropicKey(key);
    default: return false;
  }
}

// ── Schemas ─────────────────────────────────────────────────

const setKeySchema = z.object({
  provider: z.enum(["nvidia", "openai", "anthropic"]),
  key: z.string().min(1).max(512),
});

// ── Handler ─────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.keySession);
    if (guard) return guard;

    const { provider, key } = setKeySchema.parse(await request.json());

    // Get existing session keys
    const existing = await getSessionApiKeys();
    const updated: ApiKeyStore = { ...existing };

    // Validate the key (don't store invalid keys in validated state)
    const valid = await validateKey(provider, key);
    updated[provider] = { key, validated: valid };

    await setSessionApiKeys(updated);

    return NextResponse.json({ valid, provider });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest("Invalid provider or key");
    }
    console.error("[session] POST error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

export async function GET(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.default);
    if (guard) return guard;

    const keys = await getSessionApiKeys();

    // Return validation status only — never expose the keys
    const status: Record<string, { validated: boolean; hasKey: boolean }> = {};
    for (const provider of ["nvidia", "openai", "anthropic"] as LlmProvider[]) {
      const entry = keys[provider];
      status[provider] = {
        validated: entry?.validated ?? false,
        hasKey: (entry?.key?.length ?? 0) > 0,
      };
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error("[session] GET error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.keyValidate);
    if (guard) return guard;

    await clearSessionApiKeys();
    return NextResponse.json({ cleared: true });
  } catch (error) {
    console.error("[session] DELETE error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}