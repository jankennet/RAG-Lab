// ── Document types ──

export type RagDocument = {
  id: number;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
  similarity?: number;
};

export type IngestedRow = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  chunkIndex: number;
};

// ── Chat types ──

export type MessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  sources?: RagDocument[];
  createdAt: number;
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type InferenceParams = {
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
};

export const DEFAULT_INFERENCE_PARAMS: InferenceParams = {
  temperature: 0.2,
  topP: 0.9,
  topK: 4,
  maxTokens: 4096,
};

export type ChatRequest = {
  question: string;
  topK?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  model?: string;
  provider?: LlmProvider;
  apiKeys: ApiKeyStore;
  conversationHistory?: { role: MessageRole; content: string }[];
};

export type ChatResponse = {
  answer: string;
  documents: RagDocument[];
};

// ── Provider types ──

export type LlmProvider = "nvidia" | "openai" | "anthropic";

export type ApiKeyEntry = {
  key: string;
  validated: boolean;
  model?: string;
};

export type ApiKeyStore = {
  nvidia?: ApiKeyEntry;
  openai?: ApiKeyEntry;
  anthropic?: ApiKeyEntry;
};

export type ProviderConfig = {
  label: string;
  value: LlmProvider;
  icon: string;
  models: string[];
  defaultModel: string;
  baseUrl?: string;
  modelsEndpoint?: string;
  fetchable: boolean;
};

export const PROVIDERS: ProviderConfig[] = [
  {
    label: "NVIDIA NIM",
    value: "nvidia",
    icon: "🔮",
    models: [
      "meta/llama-3.3-70b-instruct",
      "mistralai/mistral-large",
      "google/gemma-2-27b-it",
    ],
    defaultModel: "meta/llama-3.3-70b-instruct",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    modelsEndpoint: "https://integrate.api.nvidia.com/v1/models",
    fetchable: true,
  },
  {
    label: "OpenAI",
    value: "openai",
    icon: "⚡",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ],
    defaultModel: "gpt-4o-mini",
    modelsEndpoint: "https://api.openai.com/v1/models",
    fetchable: true,
  },
  {
    label: "Anthropic",
    value: "anthropic",
    icon: "🧠",
    models: [
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20251001",
      "claude-opus-5-20251001",
      "claude-3-5-sonnet-latest",
    ],
    defaultModel: "claude-sonnet-4-20250514",
    fetchable: false,
  },
];

// ── Dataset types ──

export type DatasetSource = "huggingface" | "upload" | "url";

export type Dataset = {
  id: string;
  name: string;
  description: string;
  source: DatasetSource;
  sourceUrl?: string;
  rowCount: number;
  createdAt: number;
  status: "ready" | "loading" | "error";
  error?: string;
};