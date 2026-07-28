"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDashboard } from "./components/DashboardProvider";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ModelSelector from "./components/ModelSelector";
import ApiKeyMissingToast from "./components/ApiKeyMissingToast";
import { v4 as uuidv4 } from "uuid";
import type { RagDocument, LlmProvider } from "@/shared/types";

export default function ChatPage() {
  const {
    preferences,
    apiKeys,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
  } = useDashboard();
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: number;
      sources?: RagDocument[];
    }>
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInference, setShowInference] = useState(false);
  const [missingKeyProvider, setMissingKeyProvider] = useState<LlmProvider | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message on first load
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: uuidv4(),
          role: "assistant",
          content: "Hey, I'm your RAG assistant. Ask me anything about your indexed datasets.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.NEXT_PUBLIC_AUTH_TOKEN
              ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({
            question: userMessage.content,
            topK: preferences.topK ?? 4,
            temperature: preferences.temperature ?? 0.2,
            topP: preferences.topP ?? 0.9,
            maxTokens: preferences.maxTokens ?? 4096,
            provider: preferences.provider,
            model: preferences.model,
            datasetId: preferences.activeDatasetId,
            apiKey: apiKeys[preferences.provider] ?? undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
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
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
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
        <ModelSelector
          provider={preferences.provider}
          model={preferences.model}
          onProviderChange={handleProviderChange}
          onModelChange={handleModelChange}
        />
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
                max={20}
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
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