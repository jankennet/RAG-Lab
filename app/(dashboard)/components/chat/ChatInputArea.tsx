import { useRef, useCallback } from "react";
import { AttachmentChips } from "./AttachmentChips";
import { AttachmentNotice } from "./AttachmentNotice";
import ChatInput from "../ChatInput";
import type { ChatAttachment } from "@/shared/types";
import type { ChatScope } from "@/shared/types";

interface ChatInputAreaProps {
  attachmentNotice: string | null;
  setAttachmentNotice: (notice: string | null) => void;
  currentAttachments: ChatAttachment[];
  removeAttachment: (attachmentId: string) => Promise<void>;
  useOcr: boolean;
  setUseOcr: (checked: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAttachFiles: (files: File[]) => Promise<void>;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  currentScope: ChatScope;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function ChatInputArea({
  attachmentNotice,
  setAttachmentNotice,
  currentAttachments,
  removeAttachment,
  useOcr,
  setUseOcr,
  fileInputRef,
  handleAttachFiles,
  handleSubmit,
  input,
  setInput,
  isLoading,
  currentScope,
  handleKeyDown,
}: ChatInputAreaProps) {
  return (
    <div className="flex-shrink-0 border-t border-line bg-bg/80 backdrop-blur-sm">
      <div className="max-w-3xl mx-auto px-6 py-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) void handleAttachFiles(files);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 px-4 py-2 text-xs font-semibold rounded-2xl border border-line bg-panel text-text hover:border-accent/40 transition-colors"
            >
              Attach files
            </button>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={useOcr}
                onChange={(e) => setUseOcr(e.target.checked)}
                className="rounded border-line bg-panel text-accent"
              />
              Use OCR for scans/images
            </label>
          </div>
          {attachmentNotice && (
            <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">
              <span className="flex-1">{attachmentNotice}</span>
              <button
                type="button"
                onClick={() => setAttachmentNotice(null)}
                className="text-accent/70 hover:text-accent transition-colors leading-none"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}
          {currentAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {currentAttachments.map((attachment) => (
                <button
                  key={attachment.id}
                  type="button"
                  onClick={() => void removeAttachment(attachment.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-alt px-3 py-1.5 text-xs text-muted hover:text-text hover:border-accent/30 transition-colors"
                  title="Remove attachment"
                >
                  <span className="max-w-[180px] truncate">{attachment.name}</span>
                  <span className="text-[10px] uppercase tracking-wider">×</span>
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={currentScope === "chat" ? "Ask anything or attach a document..." : "Ask about current dataset or attached document..."}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 px-5 py-3 text-sm font-semibold bg-accent text-[#03111a] rounded-2xl hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? "…" : "Send"}
            </button>
          </form>
          <p className="text-xs text-muted/50 text-center mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}