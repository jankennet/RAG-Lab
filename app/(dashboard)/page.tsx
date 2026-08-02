"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard } from "./components/DashboardProvider";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ModelSelector from "./components/ModelSelector";
import ApiKeyMissingToast from "./components/ApiKeyMissingToast";
import { searchDocuments, loadIndex } from "@/client/opfs";
import type { OpfsDataset } from "@/client/opfs";
import { v4 as uuidv4 } from "uuid";
import type { RagDocument, LlmProvider } from "@/shared/types";

export default function ChatPage() {
  type ChatMessageItem = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    sources?: RagDocument[];
    kind?: "normal" | "error";
  };

  const {
    preferences,
    apiKeys,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    setActiveDataset,
  } = useDashboard();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"idle" | "searching" | "generating">("idle");
  const [showInference, setShowInference] = useState(false);
  const [missingKeyProvider, setMissingKeyProvider] = useState<LlmProvider | null>(null);
  const [datasets, setDatasets] = useState<OpfsDataset[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const totalChunks = datasets.reduce((sum, dataset) => sum + dataset.chunkCount, 0);
  const activeDataset = datasets.find((dataset) => dataset.id === preferences.activeDatasetId);
  const hasCurrentKey = Boolean(apiKeys[preferences.provider]);

  // Load available datasets for selector
  useEffect(() => {
    loadIndex().then(setDatasets).catch(() => {});
  }, []);
  // Welcome message on first load
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: uuidv4(),
          role: "assistant",
          content: "Hey, I'm your RAG Lab assistant. Ask anything about your indexed datasets and local retrieval flow.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      const key = apiKeys[preferences.provider];
      if (!key) {
        setMissingKeyProvider(preferences.provider);
        return;
      }

      const userMessage = {
        id: uuidv4(),
        role: "user" as const,
        content: input.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setLoadingPhase("searching");

      try {
        // Keyword search in OPFS for relevant documents
        const topK = preferences.topK ?? 4;
        const docs = await searchDocuments(preferences.activeDatasetId || null, userMessage.content, topK);

        setLoadingPhase("generating");

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: userMessage.content,
            topK: preferences.topK ?? 4,
            temperature: preferences.temperature ?? 0.2,
            topP: preferences.topP ?? 0.9,
            maxTokens: preferences.maxTokens ?? 4096,
            provider: preferences.provider,
            model: preferences.model,
            apiKey: apiKeys[preferences.provider] ?? undefined,
            documents: docs,
            datasetId: preferences.activeDatasetId || undefined,
          }),
        });

        if (!response.ok) {
          const errorMessage = await readErrorMessage(response);
          setMessages((prev) => [
            ...prev,
            {
              id: uuidv4(),
              role: "assistant",
              content: `Error: ${errorMessage}`,
              timestamp: Date.now(),
              kind: "error",
            },
          ]);
          return;
        }

        const data = await response.json();

        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content: data.answer,
            timestamp: Date.now(),
            sources: data.documents ?? [],
          },
        ]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown chat error";
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content: `Error: ${errorMessage}`,
            timestamp: Date.now(),
            kind: "error",
          },
        ]);
      } finally {
        setIsLoading(false);
        setLoadingPhase("idle");
      }
    },
    [input, isLoading, preferences, apiKeys]
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
            apiKey={apiKeys[preferences.provider]}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
          />
          <div className="h-5 w-px bg-line" />
          <select
            value={preferences.activeDatasetId}
            onChange={(e) => setActiveDataset(e.target.value)}
            className="max-w-[180px] truncate bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors cursor-pointer"
          >
            <option value="">All datasets</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.map((msg) => (
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
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask a question about your datasets..."
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
  );
}