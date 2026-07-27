"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import { ChatMessage } from "./components/ChatMessage";
import { DatasetCard } from "./components/DatasetCard";
import { SourceCard } from "./components/SourceCard";
import { loadDashboardPreferences } from "@/lib/dashboard-preferences";
import { dashboardDatasets, suggestedPrompts } from "@/lib/dashboard-data";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

export default function ChatPage() {
  const [prompt, setPrompt] = useState("Ask about your dataset, docs, or benchmark.");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Drop dataset, ask question, get grounded answer. Settings panel keeps provider and keys local until backend ready.",
      createdAt: Date.now()
    }
  ]);
  const [activeDatasetId, setActiveDatasetId] = useState(dashboardDatasets[0]?.id ?? "");
  const [providerState, setProviderState] = useState(loadDashboardPreferences());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProviderState(loadDashboardPreferences());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  const activeDataset = useMemo(
    () => dashboardDatasets.find((dataset) => dataset.id === activeDatasetId) ?? dashboardDatasets[0],
    [activeDatasetId]
  );

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: Date.now()
    };

    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          topK: 4,
          provider: providerState.provider,
          model: providerState.model,
          apiKeys: providerState.apiKeys,
          datasetId: activeDatasetId
        })
      });

      const payload = (await response.json()) as { answer?: string; documents?: ChatMessageType["sources"]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.answer ?? "",
          sources: payload.documents,
          createdAt: Date.now()
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: error instanceof Error ? error.message : "Unknown error",
          createdAt: Date.now()
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="chat-page">
      <div className="chat-grid">
        <div className="chat-stage panel-surface">
          <div className="chat-hero">
            <div>
              <p className="eyebrow">ChatGPT x Claude style workspace</p>
              <h1 className="page-title">Ask your data.</h1>
              <p className="page-lede">
                Bring own keys, own datasets, and one clean chat surface. Build for retrieval, benchmarking, and fast iteration.
              </p>
            </div>

            <div className="chat-metrics">
              <DatasetCard dataset={activeDataset} compact />
              <div className="metric-stack">
                <div className="metric-card">
                  <span>Provider</span>
                  <strong>{providerState.provider}</strong>
                </div>
                <div className="metric-card">
                  <span>Model</span>
                  <strong>{providerState.model}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="prompt-chips">
            {suggestedPrompts.map((item) => (
              <button key={item} type="button" className="prompt-chip" onClick={() => setPrompt(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="chat-stream">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>

          <ChatInput value={prompt} onChange={setPrompt} onSend={handleSend} sending={isSending} />
        </div>

        <aside className="chat-rail">
          <div className="rail-panel panel-surface">
            <div className="section-head">
              <h2>Sources</h2>
              <span>Live context</span>
            </div>
            <div className="source-stack">
              {messages
                .slice()
                .reverse()
                .find((message) => message.sources?.length)?.sources?.map((source, index) => (
                  <SourceCard key={`${source.id}-${source.chunkIndex}`} source={source} rank={index + 1} />
                )) ?? <p className="muted-copy">Ask question to surface retrieved chunks here.</p>}
            </div>
          </div>

          <div className="rail-panel panel-surface">
            <div className="section-head">
              <h2>Workspace</h2>
              <span>Dataset picker</span>
            </div>
            <div className="dataset-stack">
              {dashboardDatasets.map((dataset) => (
                <button key={dataset.id} type="button" className="dataset-pick" onClick={() => setActiveDatasetId(dataset.id)}>
                  <DatasetCard dataset={dataset} active={dataset.id === activeDatasetId} />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
