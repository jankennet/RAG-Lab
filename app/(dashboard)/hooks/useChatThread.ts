import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "../components/DashboardProvider";
import { loadChatThread, loadIndex, type OpfsDataset } from "@/client/opfs";
import { v4 as uuidv4 } from "uuid";
import type { ChatThread, ChatScope, LlmProvider, ChatAttachment } from "@/shared/types";
import { summarizeChatTitle } from "@/client/opfs";

export function useChatThread(chatId: string) {
  const {
    preferences: dashboardPrefs,
    apiKeyStatus,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    setActiveDataset,
    saveChatThread: persistChatThreadFn,
    refreshChatThreads,
    chatThreads,
  } = useDashboard();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [useOcr, setUseOcr] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "searching" | "generating">("idle");
  const [showInference, setShowInference] = useState(false);
  const [missingKeyProvider, setMissingKeyProvider] = useState<LlmProvider | null>(null);
  const [datasets, setDatasets] = useState<OpfsDataset[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const status = apiKeyStatus[dashboardPrefs.provider];
    if (status && !status.hasKey) {
      setMissingKeyProvider(dashboardPrefs.provider);
    }
  }, [apiKeyStatus, dashboardPrefs.provider]);

  useEffect(() => {
    loadIndex().then(setDatasets).catch(() => {});
  }, []);

  // Load (or reload) the thread whenever the routed chat id changes.
  useEffect(() => {
    let active = true;
    setThread(null);
    setInput("");

    // Prefer the in-memory draft — avoids the OPFS roundtrip (and a "Loading…"
    // hang) when the user just clicked the + button.
    const inMemory = chatThreads.find((t: ChatThread) => t.id === chatId);
    if (inMemory) {
      setThread(inMemory);
      setUseOcr(inMemory.attachments.every((attachment: ChatAttachment) => attachment.ocrEnabled));
      if (inMemory.scope === "dataset") {
        setActiveDataset(inMemory.datasetId === null ? "" : inMemory.datasetId);
      }
      return () => {
        active = false;
      };
    }

    async function loadThread() {
      if (!chatId) return;
      const loaded = await loadChatThread(chatId);
      if (!active) return;

      if (loaded) {
        setThread(loaded);
        setUseOcr(loaded.attachments.every((attachment: ChatAttachment) => attachment.ocrEnabled));
        if (loaded.scope === "dataset") {
          setActiveDataset(loaded.datasetId === null ? "" : loaded.datasetId);
        }
      }
    }

    loadThread().catch(() => {});

    return () => {
      active = false;
    };
  }, [chatId, chatThreads, setActiveDataset]);

  useEffect(() => {
    if (thread?.scope === "dataset") {
      setActiveDataset(thread.datasetId === null ? "" : thread.datasetId);
    }
  }, [setActiveDataset, thread?.datasetId, thread?.scope]);

  const persistThread = useCallback(
    async (nextThread: ChatThread) => {
      setThread(nextThread);
      await persistChatThreadFn(nextThread);
      await refreshChatThreads().catch(() => {});
    },
    [persistChatThreadFn, refreshChatThreads],
  );

  const updateThread = useCallback(
    async (updater: (current: ChatThread) => ChatThread) => {
      if (!thread) return;
      const nextThread = updater(thread);
      await persistThread(nextThread);
    },
    [persistThread, thread],
  );

  const handleThreadScopeChange = useCallback(
    async (scope: ChatScope) => {
      await updateThread((current) => ({
        ...current,
        scope,
        datasetId: scope === "dataset"
          ? (current.datasetId ?? (dashboardPrefs.activeDatasetId === "" ? null : dashboardPrefs.activeDatasetId))
          : current.datasetId,
        updatedAt: Date.now(),
      }));
    },
    [dashboardPrefs.activeDatasetId, updateThread],
  );

  const handleDatasetChange = useCallback(
    async (datasetId: string | null) => {
      await updateThread((current) => ({
        ...current,
        datasetId: current.scope === "dataset" ? (datasetId === "" || datasetId === null ? null : datasetId) : current.datasetId,
        updatedAt: Date.now(),
      }));
    },
    [updateThread],
  );

  return {
    thread,
    input,
    setInput,
    useOcr,
    setUseOcr,
    isLoading,
    setIsLoading,
    loadingPhase,
    setLoadingPhase,
    showInference,
    setShowInference,
    missingKeyProvider,
    setMissingKeyProvider,
    datasets,
    setDatasets,
    attachmentNotice,
    setAttachmentNotice,
    isDragging,
    setIsDragging,
    persistThread,
    updateThread,
    handleThreadScopeChange,
    handleDatasetChange,
    apiKeyStatus,
    preferences: dashboardPrefs,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    refreshChatThreads,
    chatThreads,
  };
}