"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ApiKeyStore, LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
  defaultDashboardPreferences,
  type DashboardPreferences,
} from "../lib/preferences";

type DashboardContextValue = {
  preferences: DashboardPreferences;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string) => void;
  setTopK: (topK: number) => void;
  setApiKey: (provider: LlmProvider, key: string) => void;
  validateApiKey: (provider: LlmProvider) => Promise<boolean>;
  setActiveDataset: (datasetId: string) => void;
  hydrate: () => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be inside DashboardProvider");
  return ctx;
}

export default function DashboardProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(defaultDashboardPreferences);
  const [mounted, setMounted] = useState(false);

  // On mount, load from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setMounted(true);
    }
  }, []);

  // Persist to localStorage whenever preferences change (after initial mount)
  useEffect(() => {
    if (mounted) {
      saveDashboardPreferences(preferences);
    }
  }, [preferences, mounted]);

  const hydrate = useCallback(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
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

  const setApiKey = useCallback((provider: LlmProvider, key: string) => {
    setPreferences((prev) => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [provider]: { key, validated: false },
      },
    }));
  }, []);

  const validateApiKey = useCallback(async (provider: LlmProvider): Promise<boolean> => {
    const entry = preferences.apiKeys[provider];
    if (!entry?.key) return false;

    try {
      const response = await fetch("/api/keys/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: entry.key }),
      });
      const data = await response.json();
      const valid = response.ok && data.valid === true;
      // Mark validated in preferences
      setPreferences((prev) => ({
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: { ...(prev.apiKeys[provider] ?? { key: "" }), validated: valid },
        },
      }));
      return valid;
    } catch {
      setPreferences((prev) => ({
        ...prev,
        apiKeys: {
          ...prev.apiKeys,
          [provider]: { ...(prev.apiKeys[provider] ?? { key: "" }), validated: false },
        },
      }));
      return false;
    }
  }, [preferences.apiKeys, setApiKey]);

  const setActiveDataset = useCallback((datasetId: string) => {
    setPreferences((prev) => ({ ...prev, activeDatasetId: datasetId }));
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        preferences,
        setProvider,
        setModel,
        setTopK,
        setApiKey,
        validateApiKey,
        setActiveDataset,
        hydrate,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}