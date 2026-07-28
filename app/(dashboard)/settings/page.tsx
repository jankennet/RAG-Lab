"use client";

import { useState } from "react";
import { useDashboard } from "../components/DashboardProvider";
import type { LlmProvider } from "@/lib/types";
import { PROVIDERS } from "@/lib/types";

export default function SettingsPage() {
  const { preferences, setProvider, setModel, setApiKey, validateApiKey } = useDashboard();
  const [activeTab, setActiveTab] = useState<"models" | "apiKeys">("models");
  const [validating, setValidating] = useState<Record<string, boolean>>({});

  const handleTestKey = async (provider: LlmProvider) => {
    setValidating((prev) => ({ ...prev, [provider]: true }));
    await validateApiKey(provider);
    setValidating((prev) => ({ ...prev, [provider]: false }));
  };

  const selectedProvider = PROVIDERS.find((p) => p.value === preferences.provider);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab("models")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "models" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
          }`}
        >
          Models
        </button>
        <button
          onClick={() => setActiveTab("apiKeys")}
          className={`ml-4 px-4 py-2 text-sm font-medium ${
            activeTab === "apiKeys" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-text"
          }`}
        >
          API Keys
        </button>
      </div>

      {/* Models tab */}
      {activeTab === "models" && (
        <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-6">
          <h2 className="font-semibold mb-4">Model Settings</h2>
          <p className="text-muted mb-4">
            Select your preferred provider and model. Changes apply to all new chats.
          </p>

          {/* Provider selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Active Provider</label>
            <select
              value={preferences.provider}
              onChange={(e) => setProvider(e.target.value as LlmProvider)}
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Model selector for active provider */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Default Model ({selectedProvider?.label ?? ""})</label>
            <select
              value={preferences.model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
            >
              {(selectedProvider?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* All providers reference */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted">All Providers</h3>
            {PROVIDERS.map((p) => (
              <div key={p.value} className="flex items-center justify-between py-2 border-b border-line/50">
                <div>
                  <span className="text-sm font-medium">{p.label}</span>
                  <p className="text-xs text-muted">Default: {p.defaultModel}</p>
                </div>
                <span className="text-xs text-muted">{p.models.length} models</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Keys tab */}
      {activeTab === "apiKeys" && (
        <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-6">
          <h2 className="font-semibold mb-4">API Keys</h2>
          <p className="text-muted mb-4">
            Add your API keys for each provider. Keys are stored in your browser's local storage.
          </p>
          <div className="space-y-6">
            {(["nvidia", "openai", "anthropic"] as LlmProvider[]).map((provider) => {
              const entry = preferences.apiKeys[provider];
              const isKeyValidated = entry?.validated ?? false;
              const isKeyEmpty = !entry?.key;

              return (
                <div key={provider} className="border-b border-line/50 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {provider === "nvidia" ? "NVIDIA NIM" : provider === "openai" ? "OpenAI" : "Anthropic"}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        isKeyValidated
                          ? "bg-green-500/20 text-green-400"
                          : isKeyEmpty
                            ? "bg-red-500/20 text-red-400"
                            : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {isKeyValidated ? "Valid" : isKeyEmpty ? "Not set" : "Untested"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-muted mb-1">API Key</label>
                    <input
                      type="password"
                      value={entry?.key ?? ""}
                      onChange={(e) => setApiKey(provider, e.target.value)}
                      className="w-full px-3 py-2 bg-bg/60 border-line rounded-md text-sm focus:outline-none focus:border-accent"
                      placeholder={`Enter your ${provider} API key`}
                    />
                    <button
                      onClick={() => handleTestKey(provider)}
                      disabled={!entry?.key || validating[provider]}
                      className="w-full px-3 py-2 bg-accent/20 hover:bg-accent/30 text-sm rounded-md transition-colors disabled:opacity-50"
                    >
                      {validating[provider] ? "Testing..." : "Test Key"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}