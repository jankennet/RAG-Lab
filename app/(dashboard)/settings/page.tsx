"use client";

import { useState } from "react";
import { useDashboard } from "../components/DashboardProvider";
import type { LlmProvider } from "@/shared/types";
import { PROVIDERS } from "@/shared/types";

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  nvidia: "NVIDIA NIM",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

export default function SettingsPage() {
  const {
    preferences,
    setProvider,
    setModel,
    submitApiKey,
    apiKeyStatus,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<"models" | "apiKeys">("models");
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});

  const selectedProvider = PROVIDERS.find((p) => p.value === preferences.provider);

  const handleSubmitKey = async (provider: LlmProvider) => {
    const key = localKeys[provider];
    if (!key) return;

    setSubmitting((prev) => ({ ...prev, [provider]: true }));
    await submitApiKey(provider, key);
    setSubmitting((prev) => ({ ...prev, [provider]: false }));
  };

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

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-muted">
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
              Set your API keys. Keys are encrypted and stored in a secure httpOnly cookie — never exposed to JavaScript or localStorage.
            </p>

            <div className="space-y-6">
              {(["nvidia", "openai", "anthropic"] as LlmProvider[]).map((provider) => {
                const status = apiKeyStatus[provider];
                const isKeyValidated = status?.validated ?? false;
                const isKeySet = status?.hasKey ?? false;
                const isSubmitting = submitting[provider] ?? false;

                return (
                  <div key={provider} className="border-b border-line/50 last:border-b-0 pb-5 last:pb-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">{PROVIDER_LABELS[provider]}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          isKeyValidated
                            ? "bg-success/20 text-success"
                            : isKeySet
                              ? "bg-warning/20 text-warning"
                              : "bg-danger/20 text-danger"
                        }`}
                      >
                        {isKeyValidated ? "Valid" : isKeySet ? "Untested" : "Not set"}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={localKeys[provider] ?? ""}
                      onChange={(e) => setLocalKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors mb-2"
                      placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                      autoComplete="off"
                    />
                    <button
                      onClick={() => handleSubmitKey(provider)}
                      disabled={!localKeys[provider] || isSubmitting}
                      className="w-full px-3 py-2 bg-accent/10 border border-accent/20 text-accent text-sm font-medium rounded-xl hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Testing & saving..." : "Save & Validate"}
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