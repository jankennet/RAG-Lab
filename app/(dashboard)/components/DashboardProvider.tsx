"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
  defaultDashboardPreferences,
  type DashboardPreferences,
} from "../lib/preferences";

type ApiKeyStatus = Record<string, { validated: boolean; hasKey: boolean }>;

type DashboardContextValue = {
  preferences: DashboardPreferences;
  apiKeyStatus: ApiKeyStatus;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string) => void;
  setTopK: (topK: number) => void;
  submitApiKey: (provider: LlmProvider, key: string) => Promise<boolean>;
  fetchApiKeyStatus: () => Promise<void>;
  setActiveDataset: (datasetId: string) => void;
  hydrate: () => void;
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
  const [mounted, setMounted] = useState(false);

  // On mount, load preferences from localStorage (NO keys)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
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

  const fetchApiKeyStatus = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/session", {
        method: "GET",
        headers: apiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeyStatus(data.status ?? {});
      }
    } catch {
      // Session not available — ignore
    }
  }, []);

  /** Submit an API key to the server. It is encrypted and stored in an httpOnly cookie. */
  const submitApiKey = useCallback(async (provider: LlmProvider, key: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ provider, key }),
      });
      const data = await response.json();
      const valid = response.ok && data.valid === true;
      // Refresh status
      await fetchApiKeyStatus();
      return valid;
    } catch {
      return false;
    }
  }, [fetchApiKeyStatus]);

  const setActiveDataset = useCallback((datasetId: string) => {
    setPreferences((prev) => ({ ...prev, activeDatasetId: datasetId }));
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        preferences,
        apiKeyStatus,
        setProvider,
        setModel,
        setTopK,
        submitApiKey,
        fetchApiKeyStatus,
        setActiveDataset,
        hydrate,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}