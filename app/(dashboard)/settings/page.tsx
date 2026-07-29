"use client";

import { useState, useEffect } from "react";
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
    apiKeys,
    setProvider,
    setModel,
    setTopK,
    setTemperature,
    setTopP,
    setMaxTokens,
    submitApiKey,
    apiKeyStatus,
    nukeEverything,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<"models" | "apiKeys" | "data">("models");
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [localKeys, setLocalKeys] = useState<Record<string, string>>({});
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [nukeConfirm, setNukeConfirm] = useState("");
  const [nuking, setNuking] = useState(false);
  const [nukeDone, setNukeDone] = useState(false);
  const [modelsFetchedLive, setModelsFetchedLive] = useState(false);

  const selectedProvider = PROVIDERS.find((p) => p.value === preferences.provider);

  // Fetch models from API when provider changes
  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      setIsFetchingModels(true);
      setModelsFetchedLive(false);
      try {
        const headers: Record<string, string> = {};
        // Send API key from localStorage so server can fetch real models
        const localKey = apiKeys[preferences.provider];
        if (localKey) {
          headers["Authorization"] = `Bearer ${localKey}`;
        }

        const response = await fetch(
          `/api/models?provider=${encodeURIComponent(preferences.provider)}`,
          { headers },
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setDynamicModels(data.models ?? []);
          if (data.fetched) setModelsFetchedLive(true);
        }
      } catch {
        // Fall back to curated list
      } finally {
        if (!cancelled) setIsFetchingModels(false);
      }
    }

    const pConfig = PROVIDERS.find((p) => p.value === preferences.provider);
    if (pConfig?.fetchable) {
      fetchModels();
    } else {
      setDynamicModels([]);
      setIsFetchingModels(false);
    }

    return () => { cancelled = true; };
  }, [preferences.provider, apiKeys]);

  // Build model list: live API results preferred, fall back to curated from API response
  const modelOptions = (() => {
    const list = dynamicModels.length > 0
      ? [...dynamicModels]
      : (selectedProvider?.models ?? []);
    // Always include currently-selected model
    if (preferences.model && !list.includes(preferences.model)) {
      list.push(preferences.model);
    }
    return list.sort();
  })();

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
          {(["models", "apiKeys", "data"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-accent text-[#03111a]"
                  : "text-muted hover:text-text"
              }`}
            >
              {tab === "models" ? "Models" : tab === "apiKeys" ? "API Keys" : "Data"}
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
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-muted">
                    Model ({selectedProvider?.label ?? ""})
                  </label>
                  {isFetchingModels && (
                    <span className="text-[10px] text-muted animate-pulse">Fetching models...</span>
                  )}
                  {!isFetchingModels && modelsFetchedLive && (
                    <span className="text-[10px] text-success">Live</span>
                  )}
                  {!isFetchingModels && dynamicModels.length > 0 && !modelsFetchedLive && (
                    <span className="text-[10px] text-muted">Curated</span>
                  )}
                </div>
                {isCustomModel ? (
                  <input
                    type="text"
                    value={preferences.model}
                    onChange={(e) => setModel(e.target.value)}
                    onBlur={() => { if (!preferences.model.trim()) setIsCustomModel(false); }}
                    className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                    placeholder="Enter model ID..."
                    autoFocus
                  />
                ) : (
                  <select
                    value={preferences.model}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomModel(true);
                      } else {
                        setModel(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors"
                  >
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="__custom__" className="text-accent">
                      ✏ Custom model...
                    </option>
                  </select>
                )}
              </div>
            </div>

            {/* Inference Parameters */}
            <div className="bg-bg-alt rounded-2xl border border-line p-6">
              <h3 className="font-semibold mb-2">Inference Parameters</h3>
              <p className="text-sm text-muted mb-6">
                Control model output behavior. Higher temperature = more creative, lower = more deterministic.
              </p>

              <div className="space-y-5">
                {/* Top K */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Top K</label>
                  <div className="flex gap-3">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={preferences.topK ?? 4}
                      onChange={(e) => setTopK(Number(e.target.value))}
                      className="flex-1 h-1.5 self-center bg-[#03111a] rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={preferences.topK ?? 4}
                      onChange={(e) => setTopK(Math.max(1, Number(e.target.value)))}
                      className="w-20 px-2 py-1.5 bg-[#03111a] border border-line rounded-lg text-sm text-text text-center outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">Number of documents retrieved for context (1–100)</p>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Temperature</label>
                  <div className="flex gap-3">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={preferences.temperature ?? 0.2}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="flex-1 h-1.5 my-auto bg-[#03111a] rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      value={preferences.temperature ?? 0.2}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 bg-[#03111a] border border-line rounded-lg text-sm text-text text-center outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">0.0 (deterministic) – 2.0 (creative)</p>
                </div>

                {/* Top P */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Top P</label>
                  <div className="flex gap-3">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={preferences.topP ?? 0.9}
                      onChange={(e) => setTopP(Number(e.target.value))}
                      className="flex-1 h-1.5 my-auto bg-accent rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={preferences.topP ?? 0.9}
                      onChange={(e) => setTopP(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 bg-[#03111a] border border-line rounded-lg text-sm text-text text-center outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">Nucleus sampling: cumulative probability threshold (0.0–1.0)</p>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">Max Tokens</label>
                  <div className="flex gap-3">
                    <input
                      type="range"
                      min={256}
                      max={32768}
                      step={256}
                      value={preferences.maxTokens ?? 4096}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      className="flex-1 h-1.5 my-auto bg-[#03111a] rounded-lg appearance-none cursor-pointer accent-accent"
                    />
                    <input
                      type="number"
                      min={1}
                      max={131072}
                      step={1}
                      value={preferences.maxTokens ?? 4096}
                      onChange={(e) => setMaxTokens(Math.max(1, Number(e.target.value)))}
                      className="w-24 px-3 py-1.5 bg-[#03111a] border border-line rounded-lg text-sm text-text text-center outline-none focus:border-accent/40 transition-colors"
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">Maximum response length in tokens</p>
                </div>
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
                      <p className="text-xs text-muted mt-0.5">
                        <a
                          href={
                            p.value === "openai"
                              ? "https://developers.openai.com/api/docs/models"
                              : p.value === "anthropic"
                                ? "https://platform.claude.com/docs/en/about-claude/models/overview"
                                : "https://build.nvidia.com/models"
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {p.value === "openai"
                            ? "openai.com"
                            : p.value === "anthropic"
                              ? "claude.com"
                              : "build.nvidia.com"}
                        </a>
                      </p>
                    </div>
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
                const isKeySet = (apiKeys[provider]?.length ?? 0) > 0;
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
                              ? "bg-accent/20 text-accent"
                              : "bg-danger/20 text-danger"
                        }`}
                      >
                        {isKeyValidated ? "Valid" : isKeySet ? "Key Configured" : "Not set"}
                      </span>
                    </div>
                    <input
                      type="password"
                      value={localKeys[provider] ?? ""}
                      onChange={(e) => setLocalKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-accent/40 transition-colors mb-2"
                      placeholder={
                        isKeySet
                          ? "Key Configured — enter a new key"
                          : `Enter your ${PROVIDER_LABELS[provider]} API key`
                      }
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

        {/* Data tab — nuke everything */}
        {activeTab === "data" && (
          <div className="bg-bg-alt rounded-2xl border border-danger/30 p-6">
            <h2 className="font-semibold mb-2 text-danger">Delete All Data</h2>
            <p className="text-sm text-muted mb-6">
              This permanently deletes all datasets, API keys, preferences, and session data from this browser. Only affects this webapp. Data cannot be recovered.
            </p>

            {nukeDone ? (
              <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success">
                All data deleted. App reset to defaults.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted mb-1.5">
                    Type <code className="text-danger bg-danger/10 px-1.5 py-0.5 rounded">DELETE</code> to confirm
                  </label>
                  <input
                    type="text"
                    value={nukeConfirm}
                    onChange={(e) => setNukeConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3 py-2.5 bg-[#03111a] border border-line rounded-xl text-sm text-text outline-none focus:border-danger/40 transition-colors"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (nukeConfirm !== "DELETE") return;
                    setNuking(true);
                    await nukeEverything();
                    setNuking(false);
                    setNukeDone(true);
                    setNukeConfirm("");
                  }}
                  disabled={nukeConfirm !== "DELETE" || nuking}
                  className="w-full px-4 py-2.5 bg-danger text-white font-semibold rounded-xl hover:bg-danger/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {nuking ? "Deleting..." : nukeConfirm === "DELETE" ? "Delete Everything" : "Delete Everything (type DELETE above)"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}