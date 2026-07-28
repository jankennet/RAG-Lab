import type { ApiKeyStore, LlmProvider } from "@/shared/types";

export type DashboardPreferences = {
  provider: LlmProvider;
  model: string;
  apiKeys: ApiKeyStore;
  activeDatasetId: string;
  topK: number;
};

export const defaultDashboardPreferences: DashboardPreferences = {
  provider: "nvidia",
  model: "meta/llama-3.1-70b-instruct",
  apiKeys: {
    nvidia: { key: "", validated: false },
    openai: { key: "", validated: false },
    anthropic: { key: "", validated: false },
    supabaseUrl: "",
    supabaseKey: "",
  },
  activeDatasetId: "",
  topK: 4,
};

const STORAGE_KEY = "ms-rag-dashboard-preferences";

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