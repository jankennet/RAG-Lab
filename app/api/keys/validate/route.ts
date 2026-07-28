import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";

export const runtime = "nodejs";

const validateRequestSchema = z.object({
  provider: z.enum(["nvidia", "openai", "anthropic"]),
  key: z.string().min(1),
});

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
      model: "claude-haiku-4-20251001",
      apiKey: key,
      maxTokens: 1,
    });
    await model.invoke([new HumanMessage("Hi")]);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { provider, key } = validateRequestSchema.parse(await request.json());

    let valid = false;
    switch (provider) {
      case "nvidia":
        valid = await testNvidiaKey(key);
        break;
      case "openai":
        valid = await testOpenAIKey(key);
        break;
      case "anthropic":
        valid = await testAnthropicKey(key);
        break;
    }

    return NextResponse.json({ valid });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ valid: false, error: message }, { status: 400 });
  }
}