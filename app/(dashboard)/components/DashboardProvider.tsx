"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
  loadApiKeys,
  saveApiKey,
  clearAllLocalData,
  defaultDashboardPreferences,
  type DashboardPreferences,
} from "../lib/preferences";
import { deleteAllDatasets } from "@/client/opfs";

type ApiKeyStatus = Record<string, { validated: boolean; hasKey: boolean }>;

type DashboardContextValue = {
  preferences: DashboardPreferences;
  apiKeyStatus: ApiKeyStatus;
  apiKeys: Partial<Record<LlmProvider, string>>;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string) => void;
  setTopK: (topK: number) => void;
  setTemperature: (temperature: number) => void;
  setTopP: (topP: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  submitApiKey: (provider: LlmProvider, key: string) => Promise<boolean>;
  fetchApiKeyStatus: () => Promise<void>;
  setActiveDataset: (datasetId: string) => void;
  hydrate: () => void;
  nukeEverything: () => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be inside DashboardProvider");
  return ctx;
}

const AUTH_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN ?? "";

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

export default function DashboardProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultDashboardPreferences);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({});
  const [apiKeys, setApiKeys] = useState<Partial<Record<LlmProvider, string>>>({});
  const [mounted, setMounted] = useState(false);

  // On mount, load preferences and api keys from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setApiKeys(loadApiKeys());
      setMounted(true);
    }
  }, []);

  // Persist preferences to localStorage (NO keys)
  useEffect(() => {
    if (mounted) {
      saveDashboardPreferences(preferences);
    }
  }, [preferences, mounted]);

  // Check session status on mount
  useEffect(() => {
    if (mounted) {
      fetchApiKeyStatus();
    }
  }, [mounted]);

  const hydrate = useCallback(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setApiKeys(loadApiKeys());
      fetchApiKeyStatus();
    }
  }, []);

  const setProvider = useCallback((provider: LlmProvider) => {
    setPreferences((prev) => {
      const config = PROVIDERS.find((p) => p.value === provider);
      return { ...prev, provider, model: config?.defaultModel ?? prev.model };
    });
  }, []);

  const setModel = useCallback((model: string) => {
    setPreferences((prev) => ({ ...prev, model }));
  }, []);

  const setTopK = useCallback((topK: number) => {
    setPreferences((prev) => ({ ...prev, topK }));
  }, []);

  const setTemperature = useCallback((temperature: number) => {
    setPreferences((prev) => ({ ...prev, temperature }));
  }, []);

  const setTopP = useCallback((topP: number) => {
    setPreferences((prev) => ({ ...prev, topP }));
  }, []);

  const setMaxTokens = useCallback((maxTokens: number) => {
    setPreferences((prev) => ({ ...prev, maxTokens }));
  }, []);

  const fetchApiKeyStatus = useCallback(async (): Promise<void> => {
    // Derive status from localStorage keys
    const local = loadApiKeys();
    const status: ApiKeyStatus = {};
    for (const p of ["nvidia", "openai", "anthropic"] as LlmProvider[]) {
      status[p] = {
        hasKey: (local[p]?.length ?? 0) > 0,
        validated: false, // server-side validation only
      };
    }
    setApiKeyStatus(status);

    // Also try server session for validation status
    try {
      const response = await fetch("/api/session", {
        method: "GET",
        headers: apiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        // Merge server validation state — but only if client has a key.
        // Server status alone is stale after a client-side wipe.
        const localKeys = loadApiKeys();
        setApiKeyStatus((prev) => {
          const next = { ...prev };
          if (data?.status) {
            for (const p of Object.keys(data.status)) {
              const hasLocalKey = (localKeys[p as LlmProvider]?.length ?? 0) > 0;
              if (hasLocalKey) {
                next[p] = { ...next[p], ...data.status[p] };
              }
            }
          }
          return next;
        });
      }
    } catch {
      // Session not available — ignore, local status is enough
    }
  }, []);

  /** Submit an API key. Saved to localStorage immediately. Also sent to server for cookie session. */
  const submitApiKey = useCallback(async (provider: LlmProvider, key: string): Promise<boolean> => {
    // Save locally first — this always works
    saveApiKey(provider, key);
    setApiKeys(loadApiKeys());
    setApiKeyStatus((prev) => ({
      ...prev,
      [provider]: { hasKey: true, validated: false },
    }));

    // Also POST to server for validation + session cookie
    let valid = false;
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ provider, key }),
      });
      const data = await response.json();
      valid = response.ok && data.valid === true;
      if (valid) {
        setApiKeyStatus((prev) => ({
          ...prev,
          [provider]: { hasKey: true, validated: true },
        }));
      }
    } catch {
      // Server unreachable — key still stored locally, usable
    }

    return valid;
  }, []);

  const setActiveDataset = useCallback((datasetId: string) => {
    setPreferences((prev) => ({ ...prev, activeDatasetId: datasetId }));
  }, []);

  /** Delete everything: server cookie, localStorage, OPFS datasets. Resets state. */
  const nukeEverything = useCallback(async (): Promise<void> => {
    // 1. Delete server session cookie
    try {
      await fetch("/api/session", { method: "DELETE", headers: apiHeaders() });
    } catch {
      // Server unreachable — continue with local wipe
    }

    // 2. Wipe OPFS datasets
    try {
      await deleteAllDatasets();
    } catch {
      // OPFS may not be available
    }

    // 3. Clear localStorage
    clearAllLocalData();

    // 4. Reset state to defaults
    setPreferences(defaultDashboardPreferences);
    setApiKeys({});
    setApiKeyStatus({});
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        preferences,
        apiKeyStatus,
        apiKeys,
        setProvider,
        setModel,
        setTopK,
        setTemperature,
        setTopP,
        setMaxTokens,
        submitApiKey,
        fetchApiKeyStatus,
        setActiveDataset,
        hydrate,
        nukeEverything,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}