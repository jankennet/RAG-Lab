// Settings → Models tab. Lifted verbatim from settings/page.tsx L148-372:
// the Provider & Model card (with live/curated status + custom-model entry),
// the four Inference-Parameter slider pairs, and the Available-Providers card.
//
// SRP change: the inline provider→models fetch effect (L65-110) is replaced by
// the shared `useProviderModels` hook (Phase 2), and the inline `modelOptions`
// builder by `buildModelOptions`. Behavior preserved — the hook reproduces the
// fetch+cancel + fetchable-gate + curated-fallback exactly; `buildModelOptions`
// reproduces the "live preferred / curated fallback / current selection always
// present / sorted" rule verbatim. The custom-model toggle (select `__custom__`
// → input, onBlur restore when blank) is copied as-is.
//
// Selects keep raw class strings because `TextField` is input-only (no select
// variant was added in Phase 2); the provider select's class is identical to
// INPUT_FULL_CLASS but on a <select>. Range/number inputs stay raw (rounded-lg,
// text-center, width variants diverge from INPUT_CLASS).

"use client";

import { useState } from "react";
import { PROVIDERS } from "@/shared/types";
import type { LlmProvider } from "@/shared/types";
import type { DashboardPreferences } from "@/app/(dashboard)/lib/preferences";
import {
  useProviderModels,
  buildModelOptions,
} from "@/app/(dashboard)/hooks/useProviderModels";

type ModelsTabProps = {
  preferences: DashboardPreferences;
  setProvider: (provider: LlmProvider) => void;
  setModel: (model: string) => void;
  setTopK: (topK: number) => void;
  setTemperature: (temperature: number) => void;
  setTopP: (topP: number) => void;
  setMaxTokens: (maxTokens: number) => void;
};

export default function ModelsTab({
  preferences,
  setProvider,
  setModel,
  setTopK,
  setTemperature,
  setTopP,
  setMaxTokens,
}: ModelsTabProps) {
  const [isCustomModel, setIsCustomModel] = useState(false);

  // Replaces the page's inline fetch effect (L65-110) — same /api/models call,
  // same cancel-on-unmount, same fetchable gate, same curated fallback.
  const { dynamicModels, isFetching, fetchedLive } = useProviderModels(preferences.provider);

  const selectedProvider = PROVIDERS.find((p) => p.value === preferences.provider);

  // Replaces the inline builder (L101-110) — live preferred, curated fallback,
  // current selection always present, sorted.
  const modelOptions = buildModelOptions(
    dynamicModels,
    selectedProvider?.models ?? [],
    preferences.model,
  );

  return (
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
            {isFetching && (
              <span className="text-[10px] text-muted animate-pulse">Fetching models...</span>
            )}
            {!isFetching && fetchedLive && (
              <span className="text-[10px] text-success">Live</span>
            )}
            {!isFetching && dynamicModels.length > 0 && !fetchedLive && (
              <span className="text-[10px] text-muted">Curated</span>
            )}
          </div>
          {isCustomModel ? (
            <input
              type="text"
              value={preferences.model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => {
                if (!preferences.model.trim()) setIsCustomModel(false);
              }}
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
  );
}
