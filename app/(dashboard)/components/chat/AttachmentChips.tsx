import type { ChatAttachment } from "@/shared/types";

interface AttachmentChipsProps {
  attachments: ChatAttachment[];
  onRemove: (attachmentId: string) => Promise<void>;
}

export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => void onRemove(attachment.id)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-bg-alt px-3 py-1.5 text-xs text-muted hover:text-text hover:border-accent/30 transition-colors"
          title="Remove attachment"
        >
          <span className="max-w-[180px] truncate">{attachment.name}</span>
          <span className="text-[10px] uppercase tracking-wider">x</span>
        </button>
      ))}
    </div>
  );
}