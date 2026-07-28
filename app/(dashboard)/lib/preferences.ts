import type { LlmProvider } from "@/shared/types";

export type DashboardPreferences = {
  provider: LlmProvider;
  model: string;
  activeDatasetId: string;
  topK: number;
  temperature: number;
  topP: number;
  maxTokens: number;
};

export const defaultDashboardPreferences: DashboardPreferences = {
  provider: "nvidia",
  model: "meta/llama-3.1-70b-instruct",
  activeDatasetId: "",
  topK: 4,
  temperature: 0.2,
  topP: 0.9,
  maxTokens: 4096,
};

const STORAGE_KEY = "ms-rag-dashboard-preferences";
const API_KEYS_KEY = "ms-rag-api-keys";

export function loadDashboardPreferences(): DashboardPreferences {
  if (typeof window === "undefined") {
    return defaultDashboardPreferences;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultDashboardPreferences;
    }

    return {
      ...defaultDashboardPreferences,
      ...JSON.parse(raw),
    } as DashboardPreferences;
  } catch {
    return defaultDashboardPreferences;
  }
}

export function saveDashboardPreferences(preferences: DashboardPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

// ── API key persistence (localStorage) ──────────────────────

/** Keys never included in DashboardPreferences. Separate store. */
export type StoredApiKeys = Partial<Record<LlmProvider, string>>;

export function loadApiKeys(): StoredApiKeys {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(API_KEYS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredApiKeys;
  } catch {
    return {};
  }
}

export function saveApiKey(provider: LlmProvider, key: string) {
  if (typeof window === "undefined") return;

  const keys = loadApiKeys();
  keys[provider] = key;
  window.localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}

export function clearApiKey(provider: LlmProvider) {
  if (typeof window === "undefined") return;

  const keys = loadApiKeys();
  delete keys[provider];
  window.localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}