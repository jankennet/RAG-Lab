"use client";

import { useState, useEffect, useRef } from "react";
import { useDashboard } from "./components/DashboardProvider";
import ChatMessage from "./components/ChatMessage";
import ChatInput from "./components/ChatInput";
import ModelSelector from "./components/ModelSelector";
import { v4 as uuidv4 } from "uuid";
import type { RagDocument } from "@/lib/types";

export default function ChatPage() {
  const { preferences } = useDashboard();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: uuidv4(),
          role: "assistant",
          content: "Hello! I'm your AI assistant. How can I help you today?",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: uuidv4(),
      role: "user" as const,
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input,
          topK: 4,
          provider: preferences.provider,
          model: preferences.model,
          apiKeys: preferences.apiKeys,
          datasetId: preferences.activeDatasetId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage = {
        id: uuidv4(),
        role: "assistant" as const,
        content: data.answer,
        timestamp: Date.now(),
        sources: data.documents ?? [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage = {
        id: uuidv4(),
        role: "assistant" as const,
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: model selector + dataset info */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-line">
        <div className="flex items-center gap-3">
          <ModelSelector
            provider={preferences.provider}
            onModelChange={() => {}}
            initialModel={preferences.model}
          />
          <span className="text-xs text-muted">
            Top K: 4
          </span>
        </div>
        <div className="text-xs text-muted">
          Provider: {preferences.provider}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pb-4 px-4">
        <div className="mb-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex px-4 py-2 bg-bg/50 backdrop-blur-sm border-t border-line">
        <ChatInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Ask a question..."
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="ml-2 px-4 py-2 bg-accent text-[#03111a] font-bold rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
        >
          {isLoading ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}