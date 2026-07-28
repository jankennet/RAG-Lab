"use client";

import { useState } from "react";
import { useDashboard } from "../components/DashboardProvider";
import type { LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";

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
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 bg-bg-alt rounded-xl w-fit">
          {(["models", "apiKeys"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-accent text-[#03111a]"
                  : "text-muted hover:text-text"
              }`}
            >
              {tab === "models" ? "Models" : "API Keys"}
            </button>
          ))}
        </div>

        {/* Models tab */}
        {activeTab === "models" && (
          <div className="space-y-8">
            <div className="bg-bg-alt rounded-2xl border border-line p-6">
              <h2 className="font-semibold mb-2">Provider & Model</h2>
              <p className="text-sm text-muted mb-6">
                Select your preferred LLM provider and model. Changes apply to all new chats.
              </p>

              {/* Provider selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-muted">Provider</label>
                <select
                  value={preferences.provider}
                  onChange={(e) => setProvider(e.target.value as LlmProvider)}
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.icon} {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-sm">
                  Model ({selectedProvider?.label ?? ""})
                </label>
                <select
                  value={preferences.model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                >
                  {(selectedProvider?.models ?? []).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Providers reference */}
            <div className="bg-bg-alt rounded-2xl border border-line p-6">
              <h3 className="font-semibold mb-4">Available Providers</h3>
              <div className="space-y-3">
                {PROVIDERS.map((p) => (
                  <div
                    key={p.value}
                    className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#03111a] border border-line"
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {p.icon} {p.label}
                      </span>
                      <p className="text-xs text-muted mt-0.5">Default: {p.defaultModel}</p>
                    </div>
                    <span className="text-xs text-muted">{p.models.length} models</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Keys tab */}
        {activeTab === "apiKeys" && (
          <div className="bg-bg-alt rounded-2xl border border-line p-6">
            <h2 className="font-semibold mb-2">API Keys</h2>
            <p className="text-sm text-muted mb-6">
              Add your API keys for each provider. Keys are stored in your browser's local storage.
            </p>

            <div className="space-y-6">
              {(["nvidia", "openai", "anthropic"] as LlmProvider[]).map((provider) => {
                const entry = preferences.apiKeys[provider];
                const isKeyValidated = entry?.validated ?? false;
                const isKeyEmpty = !entry?.key;

                const labels: Record<LlmProvider, string> = {
                  nvidia: "NVIDIA NIM",
                  openai: "OpenAI",
                  anthropic: "Anthropic",
                };

                return (
                  <div key={provider} className="border-b border-line/50 last:border-b-0 pb-5 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">{labels[provider]}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          isKeyValidated
                            ? "bg-success/20 text-success"
                            : isKeyEmpty
                              ? "bg-danger/20 text-danger"
                              : "bg-warning/20 text-warning"
                        }`}
                      >
                        {isKeyValidated ? "Valid" : isKeyEmpty ? "Not set" : "Untested"}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={entry?.key ?? ""}
                      onChange={(e) => setApiKey(provider, e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors mb-2"
                      placeholder={`Enter your ${labels[provider]} API key`}
                    />
                    <button
                      onClick={() => handleTestKey(provider)}
                      disabled={!entry?.key || validating[provider]}
                      className="w-full px-3 py-2 bg-accent/10 border border-accent/20 text-accent text-sm font-medium rounded-xl hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {validating[provider] ? "Testing..." : "Test Key"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}