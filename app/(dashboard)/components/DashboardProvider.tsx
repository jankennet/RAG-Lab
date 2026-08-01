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

  // Derive key status from localStorage on mount
  useEffect(() => {
    if (mounted) {
      const local = loadApiKeys();
      const status: ApiKeyStatus = {};
      for (const p of ["nvidia", "openai", "anthropic"] as LlmProvider[]) {
        status[p] = { hasKey: (local[p]?.length ?? 0) > 0, validated: false };
      }
      setApiKeyStatus(status);
    }
  }, [mounted]);

  const hydrate = useCallback(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setApiKeys(loadApiKeys());
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

  /** Submit API key: save to localStorage, then validate via server. */
  const submitApiKey = useCallback(async (provider: LlmProvider, key: string): Promise<boolean> => {
    saveApiKey(provider, key);
    setApiKeys(loadApiKeys());
    setApiKeyStatus((prev) => ({
      ...prev,
      [provider]: { hasKey: true, validated: false },
    }));

    let valid = false;
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  /** Delete everything: localStorage + OPFS datasets. Resets state. */
  const nukeEverything = useCallback(async (): Promise<void> => {
    try {
      await deleteAllDatasets();
    } catch {
      // OPFS may not be available
    }

    clearAllLocalData();

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
        setActiveDataset,
        hydrate,
        nukeEverything,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}