import ChatMessage from "../ChatMessage";
import type { ChatAttachment, ChatMessage as ChatMessageType, ChatScope } from "@/shared/types";
import { suggestionPrompts } from "@/app/(dashboard)/shared/constants";

interface MessageListProps {
  currentMessages: ChatMessageType[];
  isLoading: boolean;
  isDragging: boolean;
  loadingPhase: "idle" | "searching" | "generating";
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleAttachFiles: (files: File[]) => Promise<void>;
  setInput: (value: string) => void;
  input: string;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  currentAttachments: ChatAttachment[];
  removeAttachment: (attachmentId: string) => Promise<void>;
  attachmentNotice: string | null;
  setAttachmentNotice: (notice: string | null) => void;
  useOcr: boolean;
  setUseOcr: (checked: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  currentScope: ChatScope;
  threadTitle: string;
  thread: {
    scope: ChatScope;
    attachments: ChatAttachment[];
    messages: ChatMessageType[];
  } | null;
}

export default function MessageList({
  currentMessages,
  isLoading,
  isDragging,
  loadingPhase,
  messagesEndRef,
  handleAttachFiles,
  setInput,
  input,
  handleKeyDown,
  currentAttachments,
  removeAttachment,
  attachmentNotice,
  setAttachmentNotice,
  useOcr,
  setUseOcr,
  fileInputRef,
  currentScope,
  threadTitle,
  thread,
}: MessageListProps) {
  // We'll need to import ChatAttachment type
  // For now, let's assume it's available

  return (
    <>
      {/* Messages area — drag-and-drop zone */}
      <div
        className={`flex-1 overflow-y-auto relative transition-colors ${isDragging ? "bg-accent/5" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); /* setIsDragging(true) - handled by parent */ }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          /* if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); - handled by parent */
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          /* setIsDragging(false); - handled by parent */
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) void handleAttachFiles(files);
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-bg/90 border-2 border-dashed border-accent/50 rounded-3xl px-8 py-6 text-center backdrop-blur-sm">
              <p className="text-sm font-medium text-accent">Drop to attach file</p>
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto px-6 py-6">
          {currentMessages.length === 0 && !isLoading && (
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
          )}
          {currentMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                {loadingPhase === "searching"
                  ? "Searching relevant documents..."
                  : "Generating answer..."}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </>
  );
}