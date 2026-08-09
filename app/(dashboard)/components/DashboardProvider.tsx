"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { ChatScope, ChatThread, LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
  clearAllLocalData,
  loadActiveChatId,
  saveActiveChatId,
  defaultDashboardPreferences,
  type DashboardPreferences,
} from "../lib/preferences";
import {
  createChatThread as createChatThreadStore,
  deleteAllBenchmarks,
  deleteAllChats,
  deleteAllDatasets,
  deleteChatThread as deleteChatThreadStore,
  loadChatThreads,
  saveChatThread as saveChatThreadStore,
} from "@/client/opfs";

type ApiKeyStatus = Record<string, { validated: boolean; hasKey: boolean }>;

type DashboardContextValue = {
  preferences: DashboardPreferences;
  apiKeyStatus: ApiKeyStatus;
  chatThreads: ChatThread[];
  activeChatId: string;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string) => void;
  setTopK: (topK: number) => void;
  setTemperature: (temperature: number) => void;
  setTopP: (topP: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  submitApiKey: (provider: LlmProvider, key: string) => Promise<boolean>;
  setActiveDataset: (datasetId: string) => void;
  setActiveChatId: (chatId: string) => void;
  createChatThread: (meta?: { title?: string; scope?: ChatScope; datasetId?: string | null }) => Promise<ChatThread>;
  saveChatThread: (thread: ChatThread) => Promise<void>;
  deleteChatThread: (chatId: string) => Promise<void>;
  refreshChatThreads: () => Promise<void>;
  hydrate: () => void;
  nukeEverything: (options?: NukeOptions) => Promise<void>;
};

export type NukeOptions = {
  apiKeys?: boolean;
  datasets?: boolean;
  chats?: boolean;
  benchmarks?: boolean;
  preferences?: boolean;
};

const DEFAULT_NUKE_OPTIONS: Required<NukeOptions> = {
  apiKeys: true,
  datasets: true,
  chats: true,
  benchmarks: true,
  preferences: true,
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
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatIdState] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const fetchApiKeyStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { method: "GET" });
      if (!response.ok) return;
      const data = (await response.json()) as Record<string, boolean>;
      const status: ApiKeyStatus = {};
      for (const p of ["nvidia", "openai", "anthropic"] as LlmProvider[]) {
        status[p] = { hasKey: data[p] ?? false, validated: data[p] ?? false };
      }
      setApiKeyStatus(status);
    } catch {
      // server unreachable — leave status as-is (defaults to "not set" until it resolves)
    }
  }, []);

  // On mount, load preferences from localStorage and key status from the server (cookies are httpOnly, unreadable client-side)
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setActiveChatIdState(loadActiveChatId());
      setMounted(true);
      fetchApiKeyStatus();
    }
  }, [fetchApiKeyStatus]);

  // Persist preferences to localStorage (no keys — those live in httpOnly cookies)
  useEffect(() => {
    if (mounted) {
      saveDashboardPreferences(preferences);
    }
  }, [preferences, mounted]);

  const hydrate = useCallback(() => {
    if (typeof window !== "undefined") {
      setPreferences(loadDashboardPreferences());
      setActiveChatIdState(loadActiveChatId());
      fetchApiKeyStatus();
    }
  }, [fetchApiKeyStatus]);

  const refreshChatThreads = useCallback(async () => {
    const threads = await loadChatThreads();
    setChatThreads(threads);

    const storedActive = loadActiveChatId();
    if (storedActive && threads.some((thread) => thread.id === storedActive)) {
      setActiveChatIdState(storedActive);
      return;
    }

    if (threads[0]) {
      setActiveChatIdState(threads[0].id);
      saveActiveChatId(threads[0].id);
      return;
    }

    const created = await createChatThreadStore({ title: "New chat", scope: "chat", datasetId: null });
    setChatThreads([created]);
    setActiveChatIdState(created.id);
    saveActiveChatId(created.id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    refreshChatThreads().catch(() => {});
  }, [mounted, refreshChatThreads]);

  useEffect(() => {
    if (mounted) {
      saveActiveChatId(activeChatId);
    }
  }, [activeChatId, mounted]);

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

  /** Submit API key: server validates and stores it in an httpOnly cookie. No client-side persistence. */
  const submitApiKey = useCallback(async (provider: LlmProvider, key: string): Promise<boolean> => {
    setApiKeyStatus((prev) => ({ ...prev, [provider]: { hasKey: false, validated: false } }));

    let saved = false;
    let valid = false;
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const data = await response.json();
      saved = response.ok && data.saved === true;
      valid = saved && data.valid === true;
    } catch {
      saved = false;
    }

    setApiKeyStatus((prev) => ({ ...prev, [provider]: { hasKey: saved, validated: valid } }));
    return saved;
  }, []);

  const setActiveDataset = useCallback((datasetId: string) => {
    setPreferences((prev) => ({ ...prev, activeDatasetId: datasetId }));
  }, []);

  const setActiveChatId = useCallback((chatId: string) => {
    setActiveChatIdState(chatId);
    saveActiveChatId(chatId);
  }, []);

  const createChatThread = useCallback(async (meta?: { title?: string; scope?: ChatScope; datasetId?: string | null }) => {
    const thread = await createChatThreadStore(meta);
    setChatThreads((prev) => [thread, ...prev.filter((item) => item.id !== thread.id)]);
    setActiveChatId(thread.id);
    return thread;
  }, [setActiveChatId]);

  const saveChatThread = useCallback(async (thread: ChatThread) => {
    await saveChatThreadStore(thread);
    await refreshChatThreads();
  }, [refreshChatThreads]);

  const deleteChatThread = useCallback(async (chatId: string) => {
    await deleteChatThreadStore(chatId);
    const nextThreads = await loadChatThreads();
    setChatThreads(nextThreads);
    if (activeChatId === chatId) {
      const nextActive = nextThreads[0]?.id ?? "";
      if (nextActive) {
        setActiveChatId(nextActive);
      } else {
        const created = await createChatThreadStore({ title: "New chat", scope: "chat", datasetId: null });
        setChatThreads([created]);
        setActiveChatId(created.id);
      }
    }
  }, [activeChatId, setActiveChatId]);

  /** Delete everything: OPFS datasets, localStorage prefs, and server-side key cookies. Resets state. */
  const nukeEverything = useCallback(async (options?: NukeOptions): Promise<void> => {
    const opts = { ...DEFAULT_NUKE_OPTIONS, ...(options ?? {}) };

    if (opts.datasets) {
      try {
        await deleteAllDatasets();
      } catch {
        // OPFS may not be available
      }
    }

    if (opts.chats) {
      try {
        await deleteAllChats();
      } catch {
        // OPFS may not be available
      }
    }

    if (opts.benchmarks) {
      try {
        await deleteAllBenchmarks();
      } catch {
        // OPFS may not be available
      }
    }

    if (opts.apiKeys) {
      try {
        await fetch("/api/session", { method: "DELETE" });
      } catch {
        // server unreachable — cookies will still expire via maxAge, but won't be cleared immediately
      }
    }

    if (opts.preferences) {
      clearAllLocalData();
      setPreferences(defaultDashboardPreferences);
    }

    if (opts.apiKeys) {
      setApiKeyStatus({});
    }

    // Refresh chats UI when chats were wiped (auto-creates a new empty chat)
    if (opts.chats) {
      await refreshChatThreads();
    }
  }, [refreshChatThreads]);

  return (
    <DashboardContext.Provider
      value={{
        preferences,
        apiKeyStatus,
        chatThreads,
        activeChatId,
        setProvider,
        setModel,
        setTopK,
        setTemperature,
        setTopP,
        setMaxTokens,
        submitApiKey,
        setActiveDataset,
        setActiveChatId,
        createChatThread,
        saveChatThread,
        deleteChatThread,
        refreshChatThreads,
        hydrate,
        nukeEverything,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}