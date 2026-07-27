import type { ApiKeyStore, LlmProvider } from "@/lib/types";

type ProviderCallOptions = {
  messages: { role: "user" | "assistant"; content: string }[];
  model: string;
  apiKeys: ApiKeyStore;
};

async function callOpenAiCompatible(options: ProviderCallOptions & { baseUrl: string }) {
  const { messages, model, apiKeys, baseUrl } = options;
  const provider = baseUrl.includes("nvidia") ? "nvidia" : "openai";
  const apiKey = provider === "nvidia" ? apiKeys.nvidia?.key : apiKeys.openai?.key;

  if (!apiKey) throw new Error(`API key missing for ${provider}`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${provider} API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`${provider}: ${data.error.message}`);

  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(options: ProviderCallOptions) {
  const { messages, model, apiKeys } = options;
  const apiKey = apiKeys.anthropic?.key;

  if (!apiKey) throw new Error("Anthropic API key missing");

  // Convert messages to Anthropic format
  const systemMsgs = [];
  const nonSystemMsgs: { role: string; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemMsgs.push(msg.content);
    } else {
      nonSystemMsgs.push({ role: msg.role, content: msg.content });
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: nonSystemMsgs,
  };

  if (systemMsgs.length > 0) {
    body.system = systemMsgs.join("\n");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    content?: { text?: string; type?: string }[];
    error?: { message?: string };
  };

  if (data.error?.message) throw new Error(`Anthropic: ${data.error.message}`);

  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

export async function callLlm(options: ProviderCallOptions & { provider: LlmProvider }) {
  const { provider } = options;

  switch (provider) {
    case "nvidia":
      return callOpenAiCompatible({
        ...options,
        baseUrl: "https://integrate.api.nvidia.com/v1",
      });
    case "openai":
      return callOpenAiCompatible({
        ...options,
        baseUrl: "https://api.openai.com/v1",
      });
    case "anthropic":
      return callAnthropic(options);
    default:
      throw new Error(`Unknown provider: ${provider satisfies never}`);
  }
}

export async function validateApiKey(provider: LlmProvider, key: string): Promise<boolean> {
  try {
    const store: ApiKeyStore = { [provider]: { key, validated: false } };
    await callLlm({
      provider,
      model:
        provider === "anthropic"
          ? "claude-sonnet-4-20250514"
          : provider === "nvidia"
            ? "meta/llama-3.1-70b-instruct"
            : "gpt-4o-mini",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      apiKeys: store,
    });
    return true;
  } catch {
    return false;
  }
}

export function getDefaultModel(provider: LlmProvider): string {
  switch (provider) {
    case "nvidia":
      return "meta/llama-3.1-70b-instruct";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-sonnet-4-20250514";
  }
}