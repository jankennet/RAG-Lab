import { ProviderConfig, PROVIDERS } from "@/lib/types";
import { useState } from "react";

interface ModelSelectorProps {
  provider: "nvidia" | "openai" | "anthropic";
  onModelChange: (model: string) => void;
  initialModel?: string;
}

export default function ModelSelector({
  provider,
  onModelChange,
  initialModel,
}: ModelSelectorProps) {
  const providerInfo = PROVIDERS.find((p) => p.value === provider);
  const [model, setModel] = useState<string>(initialModel || (providerInfo?.defaultModel ?? ""));

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    onModelChange(selectedModel);
  };

  if (!providerInfo) {
    return <div>Invalid provider</div>;
  }

  return (
    <div className="bg-bg/50 backdrop-blur-sm rounded-xl border border-line p-4">
      <div className="mb-2">
        <span className="text-xs text-muted">Model</span>
        <select
          value={model}
          onChange={handleModelChange}
          className="mt-1 block w-full rounded-md bg-bg/60 border-line px-3 py-2 text-text-sm outline-none focus:border-accent"
        >
          {providerInfo.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="text-xs text-muted">
        Current: {model}
      </div>
    </div>
  );
}