"use client";

import { useState, useEffect } from "react";
import { PROVIDERS, type LlmProvider } from "@/shared/types";

interface ModelSelectorProps {
  provider: LlmProvider;
  model: string;
  onProviderChange: (provider: LlmProvider) => void;
  onModelChange: (model: string) => void;
}

interface ModelsApiResponse {
  provider: string;
  models: string[];
  fetched: boolean;
  defaultModel: string;
}

export default function ModelSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ModelSelectorProps) {
  const currentProvider = PROVIDERS.find((p) => p.value === provider);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // Fetch models from API when provider changes
  useEffect(() => {
    let cancelled = false;

    async function fetchModels() {
      setIsFetching(true);
      try {
        const response = await fetch(`/api/models?provider=${encodeURIComponent(provider)}`);
        if (!response.ok) return;
        const data = (await response.json()) as ModelsApiResponse;
        if (!cancelled) {
          setDynamicModels(data.models ?? []);
        }
      } catch {
        // Fail silently — fall back to hardcoded models
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    const pConfig = PROVIDERS.find((p) => p.value === provider);
    if (pConfig?.fetchable) {
      fetchModels();
    } else {
      setDynamicModels([]);
      setIsFetching(false);
    }

    return () => { cancelled = true; };
  }, [provider]);

  // Merge hardcoded defaults with dynamically fetched models (deduplicated)
  const mergedModels = (() => {
    const base = new Set(currentProvider?.models ?? []);
    for (const m of dynamicModels) base.add(m);
    return Array.from(base).sort();
  })();

  // If current model isn't in merged list, add it (custom model)
  if (model && !mergedModels.includes(model)) {
    mergedModels.push(model);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Provider select */}
      <div className="relative">
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as LlmProvider)}
          className="appearance-none bg-panel border border-line rounded-xl px-3 py-1.5 pr-6 text-xs text-text font-medium outline-none cursor-pointer focus:border-accent/40 transition-colors"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.icon} {p.label}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </div>

      {/* Model input — select or free text */}
      <div className="flex items-center gap-1">
        {isCustom ? (
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            onBlur={() => { if (!model.trim()) setIsCustom(false); }}
            className="bg-panel border border-line rounded-xl px-2 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors max-w-[200px]"
            placeholder="Enter model ID..."
            autoFocus
          />
        ) : (
          <div className="relative">
            <select
              value={model}
              onChange={(e) => {
                if (e.target.value === "__custom__") {
                  setIsCustom(true);
                } else {
                  onModelChange(e.target.value);
                }
              }}
              className="appearance-none bg-panel border border-line rounded-xl px-3 py-1.5 pr-6 text-xs text-muted outline-none cursor-pointer focus:border-accent/40 transition-colors max-w-[220px] truncate"
            >
              {mergedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom__" className="text-accent">
                ✏ Custom model...
              </option>
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none"
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 1l4 4 4-4" />
            </svg>
          </div>
        )}

        {/* Fetching indicator */}
        {isFetching && (
          <span className="ml-1 text-[10px] text-muted animate-pulse">↻</span>
        )}
      </div>
    </div>
  );
}