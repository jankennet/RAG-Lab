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

export type ChatRequest = {
  question: string;
  topK?: number;
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
  supabaseUrl?: string;
  supabaseKey?: string;
};

export type ProviderConfig = {
  label: string;
  value: LlmProvider;
  icon: string;
  models: string[];
  defaultModel: string;
  baseUrl?: string;
};

export const PROVIDERS: ProviderConfig[] = [
  {
    label: "NVIDIA NIM",
    value: "nvidia",
    icon: "🔮",
    models: [
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-405b-instruct",
      "mistralai/mistral-large",
      "google/gemma-2-27b-it",
    ],
    defaultModel: "meta/llama-3.1-70b-instruct",
    baseUrl: "https://integrate.api.nvidia.com/v1",
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
      "o1",
      "o3-mini",
    ],
    defaultModel: "gpt-4o-mini",
  },
  {
    label: "Anthropic",
    value: "anthropic",
    icon: "🧠",
    models: [
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20251001",
      "claude-sonnet-4",
      "claude-3-5-sonnet-latest",
      "claude-3-opus-latest",
      "claude-3-haiku-latest",
    ],
    defaultModel: "claude-sonnet-4-20250514",
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