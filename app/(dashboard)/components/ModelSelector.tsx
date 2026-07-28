"use client";

import { PROVIDERS, type LlmProvider } from "@/shared/types";

interface ModelSelectorProps {
  provider: LlmProvider;
  model: string;
  onProviderChange: (provider: LlmProvider) => void;
  onModelChange: (model: string) => void;
}

export default function ModelSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ModelSelectorProps) {
  const currentProvider = PROVIDERS.find((p) => p.value === provider);

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

      {/* Model select */}
      {currentProvider && (
        <div className="relative">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="appearance-none bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-muted outline-none cursor-pointer focus:border-accent/40 transition-colors max-w-[200px] truncate"
          >
            {currentProvider.models.map((m) => (
              <option key={m} value={m}>
                {m}
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
      )}
    </div>
  );
}