import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import { applyApiGuard, serverError, badRequest, RateLimits } from "@/server/auth/guard";
import { setProviderKeyCookie, clearProviderKeyCookie, clearAllProviderKeyCookies, getProviderKey } from "@/server/auth/key-cookie";
import type { LlmProvider } from "@/shared/types";



export const runtime = "nodejs";

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

const setKeySchema = z.object({
  provider: z.enum(["nvidia", "openai", "anthropic"]),
  key: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.keySession);
    if (guard) return guard;

    const { provider, key } = setKeySchema.parse(await request.json());
    const valid = await validateKey(provider, key);

    if (valid) {
    await setProviderKeyCookie(provider, key);
  }

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
  const guard = applyApiGuard(request, RateLimits.default);
  if (guard) return guard;

  const status: Record<string, boolean> = {};
  for (const p of ["nvidia", "openai", "anthropic"] as const) {
    status[p] = (await getProviderKey(p)) !== null;
  }
  return NextResponse.json(status);
}

const deleteKeySchema = z.object({
  provider: z.enum(["nvidia", "openai", "anthropic"]).optional(),
});

export async function DELETE(request: Request) {
  try {
    const guard = applyApiGuard(request, RateLimits.keySession);
    if (guard) return guard;

    // Body is optional — DELETE requests often have none. Tolerate empty/absent JSON.
    let body: unknown = {};
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return badRequest("Invalid JSON body");
    }

    const { provider } = deleteKeySchema.parse(body);

    if (provider) {
      await clearProviderKeyCookie(provider as LlmProvider);
    } else {
      await clearAllProviderKeyCookies();
    }

    return NextResponse.json({ cleared: provider ?? "all" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest("Invalid provider");
    }
    console.error("[session] DELETE error:", error instanceof Error ? error.message : error);
    return serverError();
  }
}