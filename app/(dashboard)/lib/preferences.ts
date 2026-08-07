import type { LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";

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
  model: "meta/llama-3.3-70b-instruct",
  activeDatasetId: "",
  topK: 4,
  temperature: 0.2,
  topP: 0.9,
  maxTokens: 4096,
};

const STORAGE_KEY = "ms-rag-dashboard-preferences";
const ACTIVE_CHAT_KEY = "ms-rag-active-chat-id";

export function loadDashboardPreferences(): DashboardPreferences {
  if (typeof window === "undefined") {
    return defaultDashboardPreferences;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultDashboardPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<DashboardPreferences>;
    const merged = { ...defaultDashboardPreferences, ...parsed };

    // Migrate stale model — ensure it's valid for the selected provider
    const providerCfg = PROVIDERS.find((p) => p.value === merged.provider);
    if (providerCfg && !providerCfg.models.includes(merged.model)) {
      merged.model = providerCfg.defaultModel;
    }

    return merged as DashboardPreferences;
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

/** Wipe all localStorage data managed by this app. */
export function clearAllLocalData() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_CHAT_KEY);
}

export function loadActiveChatId(): string {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(ACTIVE_CHAT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveActiveChatId(chatId: string) {
  if (typeof window === "undefined") return;
  if (!chatId) {
    window.localStorage.removeItem(ACTIVE_CHAT_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
}