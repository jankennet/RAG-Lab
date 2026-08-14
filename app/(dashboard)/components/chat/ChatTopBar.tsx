import { useCallback } from "react";
import ModelSelector from "../ModelSelector";
import ApiKeyMissingToast from "../ApiKeyMissingToast";
import type { LlmProvider, ChatScope } from "@/shared/types";

interface ChatTopBarProps {
  provider: LlmProvider;
  model: string;
  onProviderChange: (provider: LlmProvider) => void;
  onModelChange: (model: string) => void;
  missingKeyProvider: LlmProvider | null;
  onDismissMissingKey: () => void;
  currentScope: ChatScope;
  onScopeChange: (scope: ChatScope) => void;
  activeDatasetId: string | null;
  onDatasetChange: (datasetId: string | null) => void;
  datasets: { id: string; name: string }[];
  showInference: boolean;
  onToggleInference: () => void;
  threadTitle: string;
  threadScope: ChatScope;
}

export default function ChatTopBar({
  provider,
  model,
  onProviderChange,
  onModelChange,
  missingKeyProvider,
  onDismissMissingKey,
  currentScope,
  onScopeChange,
  activeDatasetId,
  onDatasetChange,
  datasets,
  showInference,
  onToggleInference,
  threadTitle,
  threadScope,
}: ChatTopBarProps) {
  const handleProviderChange = useCallback((provider: LlmProvider) => {
    onProviderChange(provider);
  }, [onProviderChange]);

  const handleModelChange = useCallback((model: string) => {
    onModelChange(model);
  }, [onModelChange]);

  const scopeLabel = (scope: ChatScope): string => {
    if (scope === "chat") return "Chat";
    if (scope === "dataset") return "Dataset";
    return "All datasets";
  };

  return (
    <>
      {missingKeyProvider && (
        <ApiKeyMissingToast
          provider={missingKeyProvider}
          onDismiss={onDismissMissingKey}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-line flex-shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ModelSelector
            provider={provider}
            model={model}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
          />
          <div className="h-5 w-px bg-line" />
          <span className="text-xs text-muted font-medium">Source</span>
          <select
            value={currentScope}
            onChange={(e) => onScopeChange(e.target.value as ChatScope)}
            className="bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors cursor-pointer"
          >
            <option value="chat">Chat</option>
            <option value="dataset">Dataset</option>
            <option value="all">All datasets</option>
          </select>
          {currentScope !== "chat" && (
            <select
              value={activeDatasetId ?? ""}
              onChange={(e) => {
                const value = e.target.value;
                onDatasetChange(value === "" ? null : value);
              }}
              className="max-w-[180px] truncate bg-panel border border-line rounded-xl px-3 py-1.5 text-xs text-text outline-none focus:border-accent/40 transition-colors cursor-pointer"
            >
              <option value="">All datasets</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </select>
          )}
          <div className="hidden md:flex items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-line px-2 py-1">{threadTitle}</span>
            <span className="rounded-full border border-line px-2 py-1">{scopeLabel(threadScope)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleInference}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors ${
                showInference
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-panel border-line text-muted hover:text-text"
              }`}
            >
              ⚙ Inference
            </button>
          </div>
        </div>
      </header>
    </>
  );
}