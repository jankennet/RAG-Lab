"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard } from "./components/DashboardProvider";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ModelSelector from "./components/ModelSelector";
import ApiKeyMissingToast from "./components/ApiKeyMissingToast";
import {
  loadIndex,
  loadChatThread,
  searchDocuments,
  smartChunkText,
  summarizeChatTitle,
  createDataset,
  updateDatasetChunks,
  makeDocuments,
  type OpfsDataset,
  type OpfsDocument,
} from "@/client/opfs";
import { v4 as uuidv4 } from "uuid";
import type { ChatAttachment, ChatScope, ChatThread, LlmProvider, RagDocument } from "@/shared/types";

const TEXT_EXTS = new Set([".txt", ".md", ".text", ".rst", ".html", ".htm", ".xml", ".csv", ".json", ".jsonl", ".sql"]);
const OCR_HINT_EXTS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"]);

function fileExt(name: string): string {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function buildAttachmentDocs(threadId: string, attachments: ChatAttachment[]): RagDocument[] {
  const docs: RagDocument[] = [];

  attachments.forEach((attachment, attachmentIndex) => {
    const chunks = smartChunkText(attachment.content, { chunkSize: 1200, chunkOverlap: 150 });
    chunks.forEach((chunk, chunkIndex) => {
      docs.push({
        id: attachmentIndex * 1000 + chunkIndex,
        sourceKey: `${threadId}:attachment:${attachmentIndex}:${chunkIndex}`,
        sourceName: attachment.name,
        sourceUrl: null,
        title: chunks.length > 1 ? `${attachment.name} — chunk ${chunkIndex + 1}` : attachment.name,
        content: chunk,
        metadata: {
          attachmentId: attachment.id,
          ocrEnabled: attachment.ocrEnabled,
          requiresOcr: attachment.requiresOcr,
          createdAt: attachment.createdAt,
        },
        chunkIndex,
      });
    });
  });

  return docs;
}

function scopeLabel(scope: ChatScope): string {
  if (scope === "chat") return "Chat";
  if (scope === "dataset") return "Dataset";
  return "All datasets";
}

export default function ChatPage() {
  const {
    preferences,
    apiKeyStatus,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    setActiveDataset,
    activeChatId,
    saveChatThread: persistChatThread,
    refreshChatThreads,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentScope = thread?.scope ?? "chat";
  const currentAttachments = thread?.attachments ?? [];
  const currentMessages = thread?.messages ?? [];

  // Show toast on mount if current provider missing API key
  useEffect(() => {
    const status = apiKeyStatus[preferences.provider];
    if (status && !status.hasKey) {
      setMissingKeyProvider(preferences.provider);
    }
  }, [apiKeyStatus, preferences.provider]);

  // Load available datasets for selector
  useEffect(() => {
    loadIndex().then(setDatasets).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    async function loadThread() {
      if (!activeChatId) return;
      const loaded = await loadChatThread(activeChatId);
      if (!active) return;

      if (loaded) {
        setThread(loaded);
        setUseOcr(loaded.attachments.every((attachment) => attachment.ocrEnabled));
        if (loaded.scope === "dataset" && loaded.datasetId) {
          setActiveDataset(loaded.datasetId);
        }
      }
    }

    loadThread().catch(() => {});

    return () => {
      active = false;
    };
  }, [activeChatId, setActiveDataset]);

  useEffect(() => {
    if (thread?.scope === "dataset" && thread.datasetId) {
      setActiveDataset(thread.datasetId);
    }
  }, [setActiveDataset, thread?.datasetId, thread?.scope]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isLoading]);

  const readErrorMessage = async (response: Response) => {
    const statusText = response.statusText || "Internal Server Error";
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        if (typeof data?.error === "string" && data.error.trim()) {
          return data.error.trim();
        }
      } catch {
        // fall through to text/status fallback
      }
    }

    try {
      const text = await response.text();
      if (text.trim()) {
        return text.trim();
      }
    } catch {
      // fall through to status fallback
    }

    return `HTTP ${response.status} ${statusText}`.trim();
  };

  const persistThread = useCallback(
    async (nextThread: ChatThread) => {
      setThread(nextThread);
      await persistChatThread(nextThread);
      await refreshChatThreads().catch(() => {});
    },
    [persistChatThread, refreshChatThreads],
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
        datasetId: scope === "dataset" ? ((current.datasetId ?? preferences.activeDatasetId) || null) : current.datasetId,
        updatedAt: Date.now(),
      }));
    },
    [preferences.activeDatasetId, updateThread],
  );

  const handleDatasetChange = useCallback(
    async (datasetId: string) => {
      setActiveDataset(datasetId);
      await updateThread((current) => ({
        ...current,
        datasetId: current.scope === "dataset" ? datasetId || null : current.datasetId,
        updatedAt: Date.now(),
      }));
    },
    [setActiveDataset, updateThread],
  );

  const handleAttachFiles = useCallback(async (files: File[]) => {
    if (!thread || files.length === 0) return;

    setAttachmentNotice(null);

    try {
      const form = new FormData();
      form.set("ocr", String(useOcr));

      const textAttachments: ChatAttachment[] = [];
      const binaryFiles: File[] = [];

      for (const file of files) {
        const ext = fileExt(file.name);
        if (TEXT_EXTS.has(ext)) {
          const raw = await file.text();
          let content = raw;
          if (ext === ".json") {
            try {
              content = JSON.stringify(JSON.parse(raw), null, 2);
            } catch {
              // keep raw
            }
          }
          textAttachments.push({
            id: uuidv4(),
            name: file.name,
            content,
            metadata: { fileType: ext.slice(1), source: "chat-upload" },
            requiresOcr: false,
            ocrEnabled: useOcr,
            createdAt: Date.now(),
          });
        } else {
          binaryFiles.push(file);
        }
      }

      if (binaryFiles.length > 0) {
        for (const file of binaryFiles) {
          form.append("files", file);
        }

        const response = await fetch("/api/upload", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "Failed to parse uploaded files");
        }

        const parsedFiles = (data as { files?: Array<{ filename: string; content: string; metadata: Record<string, unknown> }> }).files ?? [];
        for (const file of parsedFiles) {
          const ext = fileExt(file.filename);
          textAttachments.push({
            id: uuidv4(),
            name: file.filename,
            content: file.content,
            metadata: file.metadata ?? { fileType: ext.slice(1), source: "chat-upload" },
            requiresOcr: OCR_HINT_EXTS.has(ext),
            ocrEnabled: useOcr,
            createdAt: Date.now(),
          });
        }
      }

      if (textAttachments.length === 0) {
        throw new Error("No files could be parsed.");
      }

      // Auto-ingest: create OPFS dataset, chunk content, store chunks
      let autoDatasetId: string | null = null;
      try {
        const dataset = await createDataset({
          name: `Chat upload — ${new Date().toLocaleDateString()} (${textAttachments.length} files)`,
          source: "upload",
        });
        const allChunks: OpfsDocument[] = [];
        for (const attachment of textAttachments) {
          const chunks = smartChunkText(attachment.content, { chunkSize: 1200, chunkOverlap: 150 });
          const docs = makeDocuments(
            attachment.name,
            null,
            attachment.name,
            chunks,
            { attachmentId: attachment.id, fileType: attachment.metadata.fileType, source: "chat-upload" },
          );
          allChunks.push(...docs);
        }
        if (allChunks.length > 0) {
          await updateDatasetChunks(dataset.id, allChunks);
        }
        autoDatasetId = dataset.id;
      } catch (err) {
        console.warn("[attach] auto-ingest failed:", err);
        // Non-fatal — attachments still work for current chat
      }

      const nextThread: ChatThread = {
        ...thread,
        attachments: [...currentAttachments, ...textAttachments],
        scope: autoDatasetId ? "dataset" : thread.scope,
        datasetId: autoDatasetId ?? thread.datasetId,
        updatedAt: Date.now(),
      };

      await persistThread(nextThread);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setAttachmentNotice(
        `${textAttachments.length} file${textAttachments.length === 1 ? "" : "s"} attached.${autoDatasetId ? " Ingested for RAG." : ""}`
      );
    } catch (error) {
      setAttachmentNotice(error instanceof Error ? error.message : "Failed to attach files");
    }
  }, [currentAttachments, persistThread, thread, useOcr]);

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      if (!thread) return;
      await persistThread({
        ...thread,
        attachments: thread.attachments.filter((attachment) => attachment.id !== attachmentId),
        updatedAt: Date.now(),
      });
    },
    [persistThread, thread],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading || !thread) return;

      const keyStatus = apiKeyStatus[preferences.provider];
      if (!keyStatus?.hasKey) {
        setMissingKeyProvider(preferences.provider);
        return;
      }

      const userMessage = {
        id: uuidv4(),
        role: "user" as const,
        content: input.trim(),
        timestamp: Date.now(),
      };

      const nextMessages = [...currentMessages, userMessage];
      const nextTitle = thread.title === "New chat" && !thread.messages.some((message) => message.role === "user")
        ? summarizeChatTitle(userMessage.content)
        : thread.title;

      const draftThread = {
        ...thread,
        title: nextTitle,
        messages: nextMessages,
        updatedAt: Date.now(),
      };

      await persistThread(draftThread);
      setInput("");
      setIsLoading(true);
      setLoadingPhase("searching");

      try {
        const topK = preferences.topK ?? 4;
        const retrievalDocs =
          draftThread.scope === "dataset"
            ? await searchDocuments(draftThread.datasetId || preferences.activeDatasetId || null, userMessage.content, topK)
            : draftThread.scope === "all"
              ? await searchDocuments(null, userMessage.content, topK)
              : [];

        const attachmentDocs = buildAttachmentDocs(draftThread.id, draftThread.attachments);
        const documents = [...attachmentDocs, ...retrievalDocs];

        setLoadingPhase("generating");

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userMessage.content,
            temperature: preferences.temperature ?? 0.2,
            topP: preferences.topP ?? 0.9,
            maxTokens: preferences.maxTokens ?? 4096,
            provider: preferences.provider,
            model: preferences.model,
            documents,
            topK: Math.max(topK, documents.length),
            datasetId: draftThread.scope === "dataset" ? (draftThread.datasetId || preferences.activeDatasetId || undefined) : undefined,
            scope: draftThread.scope,
            conversationHistory: thread.messages.map((message) => ({ role: message.role, content: message.content })),
          }),
        });

        if (!response.ok) {
          const errorMessage = await readErrorMessage(response);
          const errorThread = {
            ...draftThread,
            messages: [
              ...draftThread.messages,
              {
                id: uuidv4(),
                role: "assistant" as const,
                content: `Error: ${errorMessage}`,
                timestamp: Date.now(),
                kind: "error" as const,
              },
            ],
            updatedAt: Date.now(),
          };
          await persistThread(errorThread);
          return;
        }

        const data = await response.json();
        const assistantMessage = {
          id: uuidv4(),
          role: "assistant" as const,
          content: data.answer,
          timestamp: Date.now(),
          sources: data.documents ?? [],
          kind: "normal" as const,
        };

        await persistThread({
          ...draftThread,
          messages: [...draftThread.messages, assistantMessage],
          updatedAt: Date.now(),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown chat error";
        await persistThread({
          ...draftThread,
          messages: [
            ...draftThread.messages,
            {
              id: uuidv4(),
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              kind: "error",
            },
          ],
          updatedAt: Date.now(),
        });
      } finally {
        setIsLoading(false);
        setLoadingPhase("idle");
      }
    },
    [apiKeyStatus, currentMessages, input, isLoading, persistThread, preferences, thread]
  );

  const handleProviderChange = useCallback(
    (provider: LlmProvider) => setProvider(provider),
    [setProvider]
  );

  const handleModelChange = useCallback(
    (model: string) => setModel(model),
    [setModel]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* Missing API key toast */}
      {missingKeyProvider && (
        <ApiKeyMissingToast
          provider={missingKeyProvider}
          onDismiss={() => setMissingKeyProvider(null)}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-line flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ModelSelector
            provider={preferences.provider}
            model={preferences.model}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
          />
          <div className="h-5 w-px bg-line" />
          <span className="text-xs text-muted font-medium">Source</span>
          <select
            value={currentScope}
            onChange={(e) => void handleThreadScopeChange(e.target.value as ChatScope)}
            className="bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors cursor-pointer"
          >
            <option value="chat">Chat</option>
            <option value="dataset">Dataset</option>
            <option value="all">All datasets</option>
          </select>
          {currentScope !== "chat" && (
          <select
            value={preferences.activeDatasetId}
            onChange={(e) => void handleDatasetChange(e.target.value)}
            className="max-w-[180px] truncate bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors cursor-pointer"
          >
            <option value="">All datasets</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          )}
          {thread && (
            <div className="hidden md:flex items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2 py-1">{thread.title}</span>
              <span className="rounded-full border border-line px-2 py-1">{scopeLabel(thread.scope)}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              Top K: {preferences.topK ?? 4}
            </span>
            <button
              onClick={() => setShowInference((v) => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                showInference
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-panel border-line text-muted hover:text-text"
              }`}
            >
              ⚙ Inference
            </button>
          </div>
        </div>
      </header>

      {/* Inference controls */}
      {showInference && (
        <div className="px-6 py-3 border-b border-line flex-shrink-0 bg-bg-alt/50">
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] text-muted font-medium">
                Top K: {preferences.topK ?? 4}
              </span>
              <input
                type="range"
                min={1}
                max={200}
                step={1}
                value={preferences.topK ?? 4}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] text-muted font-medium">
                Temp: {(preferences.temperature ?? 0.2).toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={preferences.temperature ?? 0.2}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] text-muted font-medium">
                Top P: {(preferences.topP ?? 0.9).toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={preferences.topP ?? 0.9}
                onChange={(e) => setTopP(Number(e.target.value))}
                className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </label>
            <label className="flex flex-col gap-1 min-w-[120px]">
              <span className="text-[10px] text-muted font-medium">
                Max Tokens: {preferences.maxTokens ?? 4096}
              </span>
              <input
                type="range"
                min={256}
                max={32768}
                step={256}
                value={preferences.maxTokens ?? 4096}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full h-1.5 bg-line rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </label>
          </div>
        </div>
      )}

      {/* Messages area — drag-and-drop zone */}
      <div
        className={`flex-1 overflow-y-auto relative transition-colors ${isDragging ? "bg-accent/5" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) void handleAttachFiles(files);
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-bg/90 border-2 border-dashed border-accent/50 rounded-3xl px-8 py-6 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-accent">Drop files to attach &amp; ingest</p>
              <p className="text-xs text-muted mt-1">Auto-chunked and stored for RAG</p>
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto px-6 py-6">
          {currentMessages.length === 0 && !isLoading && thread && (
            <div className="rounded-3xl border border-line bg-bg-alt/70 p-6 mb-6 space-y-2">
              <p className="text-sm font-medium text-text">Start current chat</p>
              <p className="text-sm text-muted">
                Mode: {scopeLabel(thread.scope)}. {thread.scope === "chat" ? "No dataset retrieval. Attach documents or ask general questions." : "Dataset retrieval stays scoped to this chat."}
              </p>
              <p className="text-sm text-muted">
                {currentAttachments.length > 0 ? `${currentAttachments.length} attachment${currentAttachments.length === 1 ? "" : "s"} ready.` : "Attach files below to chat about a document."}
              </p>
            </div>
          )}
          {currentMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {loadingPhase === "searching"
                  ? "Searching relevant documents..."
                  : "Generating answer..."}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-line bg-bg/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) void handleAttachFiles(files);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-2xl border border-line bg-panel text-text hover:border-accent/40 transition-colors"
              >
                Attach files
              </button>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useOcr}
                  onChange={(e) => setUseOcr(e.target.checked)}
                  className="rounded border-line bg-panel text-accent"
                />
                Use OCR for scans/images
              </label>
            </div>
            {attachmentNotice && (
              <p className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">{attachmentNotice}</p>
            )}
            {currentAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => void removeAttachment(attachment.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-alt px-3 py-1.5 text-xs text-muted hover:text-text hover:border-accent/30 transition-colors"
                    title="Remove attachment"
                  >
                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                    <span className="text-[10px] uppercase tracking-wider">×</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
              <ChatInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                placeholder={currentScope === "chat" ? "Ask anything or attach a document..." : "Ask about current dataset or attached document..."}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 px-5 py-3 text-sm font-semibold bg-accent text-[#03111a] rounded-2xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? "…" : "Send"}
              </button>
            </form>
            <p className="text-xs text-muted/50 text-center mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}