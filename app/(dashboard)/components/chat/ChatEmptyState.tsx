import { suggestionPrompts } from "@/app/(dashboard)/shared/constants";
import type { ChatAttachment, ChatScope, ChatMessage } from "@/shared/types";

interface ChatEmptyStateProps {
  currentMessages: ChatMessage[];
  isLoading: boolean;
  currentAttachments: ChatAttachment[];
  thread: { scope: ChatScope; attachments: ChatAttachment[]; messages: ChatMessage[] } | null;
  threadTitle: string;
  setInput: (value: string) => void;
}

export function ChatEmptyState({
  currentMessages,
  isLoading,
  currentAttachments,
  thread,
  threadTitle,
  setInput,
}: ChatEmptyStateProps) {
  if (currentMessages.length > 0 || isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center text-center pt-12 pb-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-text tracking-tight">
          Hello{threadTitle && threadTitle !== "New chat" ? `, ready when you are` : ""}.
        </h1>
        <p className="text-sm text-muted max-w-md mx-auto">
          {currentAttachments.length > 0
            ? `${currentAttachments.length} attachment${currentAttachments.length === 1 ? "" : "s"} ready — ask anything about ${currentAttachments.length === 1 ? "it" : "them"}.`
            : thread?.scope === "chat"
              ? "Ask anything, attach a document, or pick a suggestion below."
              : `Scoped to ${thread?.scope === "dataset" ? "Dataset" : "All datasets"} — ask a question or attach a document to enrich it.`}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
        {suggestionPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => setInput(prompt)}
            className="rounded-full border border-line bg-bg-alt/60 px-4 py-2 text-xs text-muted hover:text-text hover:border-accent/30 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}