import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
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

export function createNimEmbeddingsModel() {
  const env = getNimConfig();

  return new OpenAIEmbeddings({
    model: env.NIM_EMBEDDING_MODEL,
    apiKey: env.NIM_API_KEY,
    configuration: {
      baseURL: env.NIM_BASE_URL
    }
  });
}