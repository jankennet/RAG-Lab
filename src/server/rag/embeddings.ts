import { loadEnv, serverEnvSchema } from "@/server/db/env";
import type { ApiKeyStore, LlmProvider } from "@/shared/types";

type EmbeddingProvider = Exclude<LlmProvider, "anthropic">;

const PROVIDER_CONFIG: Record<EmbeddingProvider, { model: string; getBaseUrl: () => string; getApiKey: (keys: ApiKeyStore) => string }> = {
  nvidia: {
    model: "nvidia/nv-embedqa-e5-v5",
    getBaseUrl: () => loadEnv(serverEnvSchema).NIM_BASE_URL,
    getApiKey: (keys) => {
      const env = loadEnv(serverEnvSchema);
      return keys.nvidia?.key || env.NIM_API_KEY;
    },
  },
  openai: {
    model: "text-embedding-3-small",
    getBaseUrl: () => "https://api.openai.com/v1",
    getApiKey: (keys) => {
      const key = keys.openai?.key;
      if (!key) throw new Error("OpenAI API key missing for embeddings");
      return key;
    },
  },
};

function resolveEmbeddingProvider(provider: LlmProvider): EmbeddingProvider {
  if (provider === "anthropic") return "nvidia";
  return provider;
}

class EmbeddingClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.model = model;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embedTexts([text]).then((embeddings) => embeddings[0]);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    // Batch in chunks of 10 to avoid payload limits
    for (let i = 0; i < texts.length; i += 10) {
      const batch = texts.slice(i, i + 10);
      const batchResults = await this.embedTexts(batch);
      results.push(...batchResults);
    }
    return results;
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Embedding API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      error?: { message?: string };
    };

    if (payload.error?.message) {
      throw new Error(`Embedding API failed: ${payload.error.message}`);
    }

    const vectors = payload.data?.map((item) => item.embedding ?? []) ?? [];
    if (vectors.length !== texts.length) {
      throw new Error(`Embedding API returned ${vectors.length} vectors for ${texts.length} texts`);
    }

    return vectors;
  }
}

export function createEmbeddingsModel(provider: LlmProvider, apiKeys: ApiKeyStore) {
  const resolved = resolveEmbeddingProvider(provider);
  const config = PROVIDER_CONFIG[resolved];
  return new EmbeddingClient(config.getBaseUrl(), config.getApiKey(apiKeys), config.model);
}