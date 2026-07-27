import { ChatOpenAI } from "@langchain/openai";
import { loadEnv, serverEnvSchema } from "@/lib/env";

export function getNimConfig() {
  return loadEnv(serverEnvSchema);
}

export function createNimChatModel() {
  const env = getNimConfig();

  return new ChatOpenAI({
    model: env.NIM_CHAT_MODEL,
    apiKey: env.NIM_API_KEY,
    temperature: 0.2,
    configuration: {
      baseURL: env.NIM_BASE_URL
    }
  });
}

type NimEmbeddingMode = "query" | "passage";

class NimEmbeddingsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    const env = getNimConfig();
    this.baseUrl = env.NIM_BASE_URL.replace(/\/$/, "");
    this.apiKey = env.NIM_API_KEY;
    this.model = env.NIM_EMBEDDING_MODEL;
  }

  async embedQuery(text: string) {
    return this.embedTexts([text], "query").then((embeddings) => embeddings[0]);
  }

  async embedDocuments(texts: string[]) {
    return this.embedTexts(texts, "passage");
  }

  private async embedTexts(texts: string[], inputType: NimEmbeddingMode) {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        input_type: inputType,
        encoding_format: "float"
      })
    });

    if (!response.ok) {
      throw new Error(`NIM embeddings failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      error?: { message?: string };
    };

    if (payload.error?.message) {
      throw new Error(`NIM embeddings failed: ${payload.error.message}`);
    }

    const vectors = payload.data?.map((item) => item.embedding ?? []) ?? [];

    if (vectors.length !== texts.length) {
      throw new Error(`NIM embeddings returned ${vectors.length} vectors for ${texts.length} texts`);
    }

    return vectors;
  }
}

export function createNimEmbeddingsModel() {
  const env = getNimConfig();

  void env;

  return new NimEmbeddingsClient();
}